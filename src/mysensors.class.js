/*
 * mySensors class
 *
 * The class which implements the gateway to MySensors network and devices.
 * See mysensors.routes.js for the needed add-on to the REST API.
 */
import fs from 'fs';
import path from 'path';

import { IMqttBus, INetBus, ISerialBus, mysProto, mysTcp } from './imports.js';

export class mySensors {

    /**
     * Defaults
     */
    static d = {
        listenPort: 24010,          // TCP port number for controller -> gateway comm
        config: 'M',
        inclusionDelay: 5*60*1000,  // inclusion mode timeout 5mn
        inclusionAdvertise: 5000    // advertise every 1s
    };

    // when this feature has started
    _started = null;

    // counters
    _counters = {
        fromDevices: 0,
        toDevices: 0,
        fromController: 0,
        toController: 0
    };

    // REST client
    _caCert = null;
    _restCert = null;
    _restKey = null;

    /**
     * @param {engineApi} api the engine API as described in engine-api.schema.json
     * @param {featureCard} card a description of this feature
     * @returns {Promise} which resolves to a mySensors instance
     */
    constructor( api, card ){
        const exports = api.exports();
        const Interface = exports.Interface;
        const Msg = exports.Msg;

        // must derive from featureProvider
        Interface.extends( this, exports.featureProvider, api, card );
        Msg.debug( 'mySensors instanciation' );

        let _promise = this.fillConfig()
            .then(() => {
                // add this rather sooner, so that other interfaces may take advantage of it
                Interface.add( this, exports.ICapability );
                this.ICapability.add(
                    'checkableStatus', ( o ) => { return o.checkableStatus(); }
                );
                this.ICapability.add(
                    'helloMessage', ( o, cap ) => { return Promise.resolve( o.IRunFile.get( card.name(), cap )); }
                );
                return Interface.fillConfig( this, 'ICapability' );
            })
            .then(() => {
                Interface.add( this, exports.IForkable, {
                    v_start: this.iforkableStart,
                    v_status: this.iforkableStatus,
                    v_stop: this.iforkableStop
                });
                return Interface.fillConfig( this, 'IForkable' );
            })
            .then(() => {
                Interface.add( this, exports.IMqttClient, {
                    v_alive: this.imqttclientAlive
                });
                return Interface.fillConfig( this, 'IMqttClient' );
            })
            .then(() => {
                Interface.add( this, exports.IRunFile, {
                    v_runDir: this.irunfileRunDir
                });
                _promise = _promise.then(() => { Interface.fillConfig( this, 'IRunFile' ); });
            })
            .then(() => {
                Interface.add( this, exports.ITcpServer, {
                    v_listening: this.itcpserverListening
                });
                _promise = _promise.then(() => { Interface.fillConfig( this, 'ITcpServer' ); });
            })
            .then(() => {
                Interface.add( this, IMqttBus, {
                    v_incomingMessage: this._incomingMessage
                });
                _promise = _promise.then(() => { Interface.fillConfig( this, 'IMqttBus' ); });
            })
            .then(() => {
                Interface.add( this, INetBus, {
                    v_incomingMessage: this._incomingMessage
                });
                _promise = _promise.then(() => { Interface.fillConfig( this, 'IMqttBus' ); });
            })
            .then(() => {
                Interface.add( this, ISerialBus, {
                    v_incomingMessage: this._incomingMessage
                });
                _promise = _promise.then(() => { Interface.fillConfig( this, 'IMqttBus' ); });
            })
            .then(() => { return Promise.resolve( this ); });

        return _promise;
    }

    // try to build the base URL to address the REST API server
    // @param {Object} conf this feature configuration
    // @returns {Promise} which resolves to provided conf
    _fillConfigRestUrl( conf ){
        const featApi = this.api();
        const exports = featApi.exports();
        let _promise = Promise.resolve( conf );
        // only addressable by feature at the moment
        //  see also core/MqttConnect class for other addressing modes
        if( conf.REST && conf.REST.feature ){
            let _featConfig = this.getConfig( conf.REST.feature, 'REST' );
            if( _featConfig ){
                conf.REST.baseUrl = 'https://'+_featConfig.host+':'+_featConfig.port+_featConfig.urlPrefix;
            } else {
                _promise = featApi.pluginManager().getConfig( featApi, conf.REST.feature, 'REST' )
                .then(( _featConfig ) => {
                    if( _featConfig ){
                        conf.REST.baseUrl = 'https://'+_featConfig.host+':'+_featConfig.port;
                    } else {
                        exports.Msg.warn( 'mySensors._fillConfigRestUrl() feature='+conf.REST.feature+' config resolves to null' );
                    }
                    return Promise.resolve( conf );
                });
            }
        }
        return _promise;
    }

    /*
     * Deal with messages received from a device: what to do with it?
     *  - either ignore, leaving to the MySensors library the responsability to handle it
     *  - directly answer to the device from the gateway
     *  - forward the information/action to the controlling application
     * @param {mysMessage} msg
     */
    _incomingMessage( msg ){
        this._counters.fromDevices += 1;
        mysProto.incomingMessage( this, msg );
    }

    /*
     * @param {String} name the name of the feature
     * @param {Callback|null} cb the funtion to be called on IPC messages reception (only relevant if a process is forked)
     * @param {String[]} args arguments list (only relevant if a process is forked)
     * @returns {Promise}
     *  - which never resolves in the forked process (server hosting) so never let the program exits
     *  - which resolves to the forked child process in the main process
     * [-implementation Api-]
     */
    iforkableStart( name, cb, args ){
        const exports = this.api().exports();
        const _forked = exports.IForkable.forkedProcess();
        exports.Msg.debug( 'mySensors.iforkableStart()', 'forkedProcess='+_forked );
        if( _forked ){
            const featCard = this.feature();
            return Promise.resolve( true )
                .then(() => { this.ITcpServer.create( featCard.config().ITcpServer.port ); })
                .then(() => { exports.Msg.debug( 'mySensors.iforkableStart() tcpServer created' ); })
                .then(() => { this.IMqttClient.connects(); })
                .then(() => { this._started = exports.utils.now(); })
                .then(() => {
                    switch( featCard.config().mySensors.type ){
                        case 'mqtt':
                            this.IMqttBus.start();
                            break;
                        case 'net':
                            this.INetBus.start();
                            break;
                        case 'serial':
                            this.ISerialBus.start();
                            break;
                    }
                })
                .then(() => { return new Promise(() => {}); });
        } else {
            return Promise.resolve( exports.IForkable.fork( name, cb, args ));
        }
    }

    /*
     * Get the status of the service
     * @returns {Promise} which resolves to the status object
     * [-implementation Api-]
     */
    iforkableStatus(){
        const exports = this.api().exports();
        exports.Msg.debug( 'mySensors.iforkableStatus()' );
        exports.utils.tcpRequest( this.feature().config().ITcpServer.port, 'iz.status' )
            .then(( answer ) => {
                exports.Msg.debug( 'mySensors.iforkableStatus()', 'receives answer to \'iz.status\'', answer );
            }, ( failure ) => {
                // an error message is already sent by the called self.api().exports().utils.tcpRequest()
                //  what more to do ??
                //Msg.error( 'TCP error on iz.stop command:', failure );
            });
    }

    /*
     * @returns {Promise}
     * [-implementation Api-]
     */
    iforkableStop(){
        const exports = this.api().exports();
        exports.Msg.debug( 'mySensors.iforkableStop()' );
        exports.utils.tcpRequest( this.feature().config().ITcpServer.port, 'iz.stop' )
            .then(( answer ) => {
                exports.Msg.debug( 'mySensors.iforkableStop()', 'receives answer to \'iz.stop\'', answer );
            }, ( failure ) => {
                // an error message is already sent by the called self.api().exports().utils.tcpRequest()
                //  what more to do ??
                //IMsg.error( 'TCP error on iz.stop command:', failure );
            });
    }

    /*
     * @returns {Promise} which resolves to the payload of the 'alive' message
     * we want here publish the content of our status (without the 'name' top key)
     * [-implementation Api-]
     */
    imqttclientAlive(){
        return this.publiableStatus().then(( res ) => {
            const name = Object.keys( res )[0];
            return res[name];
        });
    }

    /*
     * @returns {String} the full pathname of the run directory
     * [-implementation Api-]
     */
    irunfileRunDir(){
        this.api().exports().Msg.debug( 'mySensors.irunfileRunDir()' );
        return this.api().config().runDir();
    }

    /*
     * What to do when this ITcpServer is ready listening ?
     *  -> write the runfile before advertising parent to prevent a race condition when writing the file
     *  -> send the current service status
     * @param {Object} tcpServerStatus
     * [-implementation Api-]
     */
    itcpserverListening( tcpServerStatus ){
        const exports = this.api().exports();
        exports.Msg.debug( 'mySensors.itcpserverListening()' );
        const featCard = this.feature();
        const _name = featCard.name();
        const _port = featCard.config().ITcpServer.port;
        let _msg = 'Hello, I am \''+_name+'\' MySensors gateway';
        _msg += ', running with pid '+process.pid+ ', listening on port '+_port;
        let st = new exports.Checkable();
        st.pids = [ process.pid ];
        st.ports = [ _port ];
        delete st.startable;
        delete st.reasons;
        let status = {};
        status[_name] = {
            module: featCard.module(),
            class: featCard.class(),
            ... st,
            event: 'startup',
            helloMessage: _msg,
            status: 'running'
        };
        //console.log( 'itcpserverListening() status', status );
        this.IRunFile.set( _name, status );
        this.IForkable.advertiseParent( status );
    }

    /*
     * @returns {Promise} which must resolve to an object conform to check-status.schema.json
     */
    checkableStatus(){
        const exports = this.api().exports();
        exports.Msg.debug( 'mySensors.checkableStatus()' );
        const _name = this.feature().name();
        const _json = this.IRunFile.jsonByName( _name );
        let o = new exports.Checkable();
        if( _json && _json[_name] ){
            o.pids = _json[_name].pids;
            o.ports = _json[_name].ports;
            o.startable = o.pids.length === 0 && o.ports.length === 0;
        } else {
            o.startable = true;
        }
        return Promise.resolve( o );
    }

    /*
     * @returns {Promise} which resolves to the filled feature configuration
     * Note:
     *  We provide our own default for ITcpServer port to not use the common value
     */
    fillConfig(){
        let _promise = super.fillConfig();
        const exports = this.api().exports();
        exports.Msg.debug( 'mySensors.fillConfig()' );
        let _config = this.feature().config();
            _promise = _promise
            .then(() => {
                if( !_config.class ){
                    _config.class = this.constructor.name;
                }
                if( Object.keys( _config ).includes( 'ITcpServer' ) && !Object.keys( _config.ITcpServer ).includes( 'port' )){
                    _config.ITcpServer.port = mySensors.d.listenPort;
                }
                if( !_config.mySensors ){
                    throw new Error( 'mySensors expects a \'mySensors\' configuration group' );
                }
                if( _config.mySensors.type !== 'mqtt' && _config.mySensors.type !== 'net' && _config.mySensors.type !== 'serial' ){
                    throw new Error( 'mySensors expects a \'mySensors.type\' gateway type, found \''+_config.mySensors.type+'\'' );
                }
                if( !_config.mySensors.config ){
                    _config.mySensors.config = mySensors.d.config;
                }
                if( !_config.mySensors.inclusionDelay ){
                    _config.mySensors.inclusionDelay = mySensors.d.inclusionDelay;
                }
            })
            .then(() => { return this._fillConfigRestUrl( _config ); })
            .then(() => {
                if( _config.REST && _config.REST.cert && _config.REST.key ){
                    this._caCert = fs.readFileSync( path.join( this.api().storageDir(), this.api().config().core().rootCA ));
                    this._restCert = fs.readFileSync( path.join( this.api().storageDir(), _config.REST.cert ));
                    this._restKey = fs.readFileSync( path.join( this.api().storageDir(), _config.REST.key ));
                }
            })
        return _promise;
    }

    /**
     * @returns {Object} whch contains the client key and cert
     */
    getCerts(){
        return {
            ca: this._caCert,
            cert: this._restCert,
            key: this._restKey
        }
    }

    /*
     * If the service had to be SIGKILL'ed to be stoppped, then gives it an opportunity to make some cleanup
     */
    postStop(){
        super.postStop();
        this.api().exports().Msg.debug( 'mySensors.postStop()' );
        this.IRunFile.remove( this.feature().name());
    }

    /**
     * @returns {Promise} which resolves to a status Object
     * Note:
     *  The object returned by this function (aka the 'status' object) is used:
     *  - as the answer to the 'iz.status' TCP request
     *  - by the IMQttClient when publishing its 'alive' message
     */
    publiableStatus(){
        const exports = this.api().exports();
        const featCard = this.feature();
        const _serviceName = featCard.name();
        exports.Msg.debug( 'mySensors.publiableStatus()', 'serviceName='+_serviceName );
        const self = this;
        let status = {};
        // run-status.schema.json (a bit extended here)
        const _runStatus = function(){
            return new Promise(( resolve, reject ) => {
                const o = {
                    module: featCard.module(),
                    class: featCard.class(),
                    pids: [ process.pid ],
                    ports: [ featCard.config().ITcpServer.port ],
                    runfile: self.IRunFile.runFile( _serviceName ),
                    started: self._started,
                    messages: self._counters
                };
                exports.Msg.debug( 'mySensors.publiableStatus()', 'runStatus', o );
                status = { ...status, ...o };
                resolve( status );
            });
        };
        return Promise.resolve( true )
            .then(() => { return _runStatus(); })
            .then(() => { return this.IStatus ? this.IStatus.run( status ) : status; })
            .then(( res ) => {
                let featureStatus = {};
                featureStatus[_serviceName] = res;
                //console.log( 'coreController.publiableStatus() featureStatus', featureStatus );
                return Promise.resolve( featureStatus );
            });
    }

    /*
     * Called on each and every loaded add-on when the main hosting feature has terminated with its initialization
     * Time, for example, to increment all interfaces we are now sure they are actually implemented
     * Here: add verbs to ITcpServer
     */
    ready(){
        super.ready();
        this.api().exports().Msg.debug( 'mySensors.ready()' );
        mysTcp.ready( this );
    }

    /**
     * terminate the server
     * Does its best to advertise the main process of what it will do
     * (but be conscious that it will also close the connection rather soon)
     * @param {string[]|null} args the parameters transmitted after the 'iz.stop' command
     * @param {Callback} cb the function to be called back to acknowledge the request
     * @returns {Promise} which resolves when the server is terminated
     * Note:
     *  Receiving 'iz.stop' command calls this terminate() function, which has the side effect of.. terminating!
     *  Which sends a SIGTERM signal to this process, and so triggers the signal handler, which itself re-calls
     *  this terminate() function. So, try to prevent a double execution.
     */
    terminate( words=[], cb=null ){
        const exports = this.api().exports();
        const featCard = this.feature();
        exports.Msg.debug( 'mySensors.terminate()' );

        const _name = featCard.name();
        const _module = featCard.module();
        const self = this;

        // closing the TCP server
        //  in order the TCP server be closeable, the current connection has to be ended itself
        //  which is done by the promise
        let _promise = Promise.resolve( true )
            .then(() => {
                if( cb && typeof cb === 'function' ){
                    cb({ name:_name, module:_module, class:featCard.class(), pid:process.pid, port:featCard.config().ITcpServer.port });
                }
                return self.ITcpServer.terminate();
            })
            .then(() => { return self.IMqttClient.terminate(); })
            .then(() => { return self.IMqttBus.terminate(); })
            .then(() => { return self.INetBus.terminate(); })
            .then(() => { return self.ISerialBus.terminate(); })
            .then(() => {
                // we auto-remove from runfile as late as possible
                //  (rationale: no more runfile implies that the service is no more testable and expected to be startable)
                self.IRunFile.remove( _name );
                exports.Msg.info( _name+' mySensors terminating with code '+process.exitCode );
                return Promise.resolve( true)
                //process.exit();
            });

        return _promise;
    }
}
