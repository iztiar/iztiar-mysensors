/*
 * mySensors class
 *
 * The class which implements the gateway to MySensors network and devices.
 * See mysensors.routes.js for the needed add-on to the REST API.
 */
import fs from 'fs';
import path from 'path';

import { IMqttBus, INetBus, ISerialBus, mysConsts, mysMessage, rest } from './imports.js';

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

    /**
     * The commands which can be received by this mySensors service via the TCP communication port
     * - keys are the commands
     *   > label {string} a short help message
     *   > fn {Function} the execution function (cf. above)
     *   > endConnection {Boolean} whether the server should close the client connection
     *      alternative being to wait for the client closes itself its own connection
     */
    static verbs = {
        'iz.status': {
            label: 'return the status of this mySensors service',
            fn: mySensors._izStatus
        },
        'iz.stop': {
            label: 'stop this mySensors service',
            fn: mySensors._izStop,
            end: true
        },
        'mySensors': {
            label: 'mySensors command',
            fn: mySensors._mySensorsCmd
        }
    };

    // returns the full status of the server
    static _izStatus( self, reply ){
        return self.publiableStatus()
            .then(( status ) => {
                reply.answer = status;
                return Promise.resolve( reply );
            });
    }

    // terminate the server and its relatives
    static _izStop( self, reply ){
        self.terminate( reply.args, ( res ) => {
            reply.answer = res;
            self.api().exports().Msg.debug( 'mySensors.izStop()', 'replying with', reply );
            return Promise.resolve( reply );
        });
        return Promise.resolve( true );
    }

    // a 'mySensors' command received from the application
    static _mySensorsCmd( self, reply ){
        if( reply.args.length >= 1 ){
            const _args1 = reply.args.length >= 2 ? reply.args[1] : null;
            self._counters.fromController += 1;
            switch( reply.args[0] ){

                // inclusion on|off|null
                case 'inclusion':
                    if( _args1 === 'on' || _args1 === 'off' ){
                        self.inclusionMode( self, _args1 === 'on' );
                    }
                    const _delay = self.feature().config().mySensors.inclusionDelay;
                    if( _args1 === 'off' || ( _args1 === null && !self._inclusionMode )){
                        reply.answer = { inclusion: 'off', delay: _delay };
                    } else if( _args1 === 'on' || ( _args1 === null && self._inclusionMode )){
                        reply.answer = { inclusion: 'on', started: self._inclusionStarted, delay: _delay, now: Date.now() };
                    } else {
                        reply.answer = "mySensors 'inclusion' command expects one 'on|off' argument, '"+_args1+"' found";
                    }
                    break;

                default:
                    reply.answer = "unknown '"+reply.args[0]+"' mySensors command";
                    break;
            }
        } else {
            reply.answer = "mySensors command expects at least one argument";
        }
        return Promise.resolve( reply );
    }

    // when this feature has started
    _started = null;

    // inclusion mode
    _inclusionMode = false;
    _inclusionStarted = null;
    _inclusionTimeoutId = null;

    // during inclusion mode, keep a cache of mySensors vs. controller data
    //  index by mySensors/node_id
    //  data name, equipId
    _inclusionCache = null;

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
                    v_incomingMessage: this.incomingMessage
                });
                _promise = _promise.then(() => { Interface.fillConfig( this, 'IMqttBus' ); });
            })
            .then(() => {
                Interface.add( this, INetBus, {
                    v_incomingMessage: this.incomingMessage
                });
                _promise = _promise.then(() => { Interface.fillConfig( this, 'IMqttBus' ); });
            })
            .then(() => {
                Interface.add( this, ISerialBus, {
                    v_incomingMessage: this.incomingMessage
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

    /**
     * @param {String} nodeid
     * @param {Object} res the request
     */
    inclusionCacheAdd( nodeid, res ){
        const Msg = this.api().exports().Msg;
        if( Object.keys( this._inclusionCache ).includes( nodeid )){
            Msg.debug( 'mySensorsClass.inclusionCacheAdd() nodeid='+nodeid+' already set' );

        } else if( res.OK ){
            const _data = { name: res.OK.name, equipId: res.OK.equipId };
            this._inclusionCache[nodeid] = _data;
            Msg.debug( 'mySensorsClass.inclusionCacheAdd() nodeid='+nodeid, _data );

        } else {
            Msg.error( 'mySensorsClass.inclusionCacheAdd() nodeid='+nodeid, 'res=', res );
        }
    }

    /**
     * @param {mySensorsClass} instance
     * @param {Boolean} set whether to start (true) or stop the inclusion mode
     */
    inclusionMode( instance, set ){
        const Msg = instance.api().exports().Msg;
        Msg.debug( 'mySensorsClass.inclusionMode() set='+set );
        instance._inclusionMode = set;
        const _fClear = function(){
            if( instance._inclusionTimeoutId ){
                clearTimeout( instance._inclusionTimeoutId );
                instance._inclusionStarted = null;
                instance._inclusionTimeoutId = null;
            }
            instance._inclusionCache = null;
        };
        _fClear();
        if( set ){
            instance._inclusionTimeoutId = setTimeout( instance.inclusionMode, instance.feature().config().mySensors.inclusionDelay, instance, false );
            instance._inclusionCache = {};
            instance._inclusionStarted = Date.now();
        }
    }

    /**
     * Deal with messages received from a device: what to do with it?
     *  - either ignore, leaving to the MySensors library the responsability to handle it
     *  - directly answer to the device from the gateway
     *  - forward the information/action to the controlling application
     * @param {mysMessage} msg
     */
    incomingMessage( msg ){
        this._counters.fromDevices += 1;
        const exports = this.api().exports();
        exports.Msg.debug( 'mySensors.incomingMessages()', msg );
        if( msg.isIncomingAck()){
            exports.Msg.info( 'mySensors.incomingMessage() ignoring incoming ack message', msg );
        } else {
            switch( msg.command ){
                // presentation message are sent by the device on each boot of the device
                //  this is a good time to register them in the controller application (as far as we are in inclusion mode)
                //  we buffer all these messages, sending the total to the controller when we thing we have all received
                case mysConsts.C.C_PRESENTATION:
                    if( this._inclusionMode ){
                        // create/set the node
                        if( msg.sensor_id === '255' ){
                            rest.request( this, 'PUT', '/v1/equipment/class/mySensors/'+msg.node_id+'/add', {
                                mySensors: {
                                    nodeType: msg.type_str,
                                    libVersion: msg.payload
                                }
                            }).then(( res ) => {
                                exports.Msg.debug( 'mySensors.incomingMessages() res=', res );
                                this.inclusionCacheAdd( msg.node_id, res );
                            });
                            // create/set a command
                        } else if( Object.keys( this._inclusionCache ).includes( msg.node_id )){
                            const equip = this._inclusionCache[msg.node_id];
                            let _payload = {
                                mySensors: {
                                    sensorType: msg.type_str
                                }
                            };
                            if( msg.payload && msg.payload.length ){
                                _payload.mySensors.sensorName = msg.payload;
                            }
                            rest.request( this, 'PUT', '/v1/command/equipment/'+equip.equipId+'/'+msg.sensor_id, _payload )
                                .then(( res ) => {
                                    exports.Msg.debug( 'mySensors.incomingMessages() res=', res );
                                });
                        } else {
                            exports.Msg.info( 'mySensors.incomingMessage() ignoring sensor presentation message as node is unknown', msg );
                        }
                    } else {
                        exports.Msg.info( 'mySensors.incomingMessage() ignoring presentation message while not in inclusion mode', msg );
                    }
                    break;
                case mysConsts.C.C_SET:
                    this.sendToController( 'setValue', msg );
                    break;
                case mysConsts.C.C_REQ:
                    this.sendToController( 'requestValue', msg );
                    break;
                // some of the internal messages are to be forwarded to the controlling application
                //  while some may be answered by the gateway itself
                //  some are not incoming message at all
                case mysConsts.C.C_INTERNAL:
                    switch( msg.type ){
                        // to be transmitted to the controller
                        case mysConsts.I.I_BATTERY_LEVEL:
                            this.sendToController( 'setBatteryLevel', msg );
                            break;
                        // request a new Id from a controller, have to answer to the device
                        case mysConsts.I.I_ID_REQUEST:
                            rest.request( this, 'GET', '/v1/counter/mySensors/next' ).then(( res ) => {
                                //exports.Msg.debug( 'mySensors.incomingMessages() res='+res );
                                if( res ){
                                    msg.setType( mysConsts.I.I_ID_RESPONSE );
                                    this.sendToDevice( msg, res.lastId );
                                }
                            });
                            break;
                        // to be answered by the gateway
                        case mysConsts.I.I_TIME:
                            this.sendToDevice( msg, Date.now());
                            break;
                        case mysConsts.I.I_CONFIG:
                            this.sendToDevice( msg, this.feature().config().mySensors.config );
                            break;
                        case mysConsts.I.I_LOG_MESSAGE:
                            exports.Logger.info( 'mySensors.incomingMessage()', msg );
                            break;
                        case mysConsts.I.I_SKETCH_NAME:
                            if( this._inclusionMode && msg.sensor_id === '255' ){
                                rest.request( this, 'PUT', '/v1/equipment/class/mySensors/'+msg.node_id+'/add', {
                                        mySensors: {
                                            sketchName: msg.payload
                                        }
                                }).then(( res ) => {
                                    exports.Msg.debug( 'mySensors.incomingMessages() res=', res );
                                    this.inclusionCacheAdd( msg.node_id, res );
                                });
                            } else {
                                exports.Msg.info( 'mySensors.incomingMessage() ignoring presentation message while not in inclusion mode', msg );
                            }
                            break;
                        case mysConsts.I.I_SKETCH_VERSION:
                            if( this._inclusionMode && msg.sensor_id === '255' ){
                                rest.request( this, 'PUT', '/v1/equipment/class/mySensors/'+msg.node_id+'/add', {
                                        mySensors: {
                                            sketchVersion: msg.payload
                                        }
                                }).then(( res ) => {
                                    exports.Msg.debug( 'mySensors.incomingMessages() res=', res );
                                    this.inclusionCacheAdd( msg.node_id, res );
                                });
                            } else {
                                exports.Msg.info( 'mySensors.incomingMessage() ignoring presentation message while not in inclusion mode', msg );
                            }
                            break;
                        case mysConsts.I.I_DEBUG:
                            exports.Logger.debug( 'mySensors.incomingMessage()', msg );
                            break;
                        // these messages should never be incoming from the devices or are just ignored
                        case mysConsts.I.I_VERSION:
                        case mysConsts.I.I_INCLUSION_MODE:
                        case mysConsts.I.I_ID_RESPONSE:
                        case mysConsts.I.I_FIND_PARENT:
                        case mysConsts.I.I_FIND_PARENT_RESPONSE:
                        case mysConsts.I.I_CHILDREN:
                        case mysConsts.I.I_REBOOT:
                        case mysConsts.I.I_GATEWAY_READY:
                        case mysConsts.I.I_SIGNING_PRESENTATION:
                        case mysConsts.I.I_NONCE_REQUEST:
                        case mysConsts.I.I_NONCE_RESPONSE:
                        case mysConsts.I.I_PRESENTATION:
                        case mysConsts.I.I_LOCKED:
                        case mysConsts.I.I_PING:
                        case mysConsts.I.I_PONG:
                        case mysConsts.I.I_HEARTBEAT_REQUEST:
                        case mysConsts.I.I_DISCOVER_REQUEST:
                        case mysConsts.I.I_DISCOVER_RESPONSE:
                        case mysConsts.I.I_HEARTBEAT_RESPONSE:
                        case mysConsts.I.I_REGISTRATION_REQUEST:
                        case mysConsts.I.I_REGISTRATION_RESPONSE:
                        case mysConsts.I.I_SIGNAL_REPORT_REQUEST:
                        case mysConsts.I.I_SIGNAL_REPORT_REVERSE:
                        case mysConsts.I.I_SIGNAL_REPORT_RESPONSE:
                        case mysConsts.I.I_PRE_SLEEP_NOTIFICATION:
                        case mysConsts.I.I_POST_SLEEP_NOTIFICATION:
                            exports.Msg.info( 'mySensors.incomingMessage() ignoring unexpected internal message', msg );
                            break;
                        default:
                            exports.Msg.error( 'mySensors.incomingMessage() ignoring unknown type', msg );
                            break;
                    }
                    break;
                case mysConsts.C.C_STREAM:
                    exports.Msg.info( 'mySensors.incomingMessage() unexpected command (not the right sens for an OTA firmware update)', msg );
                    break;
                default:
                    exports.Msg.error( 'mySensors.incomingMessage() unknown command', msg );
                    break;
            }
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
        const exports = this.api().exports();
        exports.Msg.debug( 'mySensors.ready()' );
        const self = this;
        Object.keys( mySensors.verbs ).every(( key ) => {
            const o = mySensors.verbs[key];
            self.ITcpServer.add( key, o.label, o.fn, o.end ? o.end : false );
            return true;
        });
    }

    /**
     * @param {String} command
     *  createDevice
     *  requestValue
     *  setBatteryLevel
     *  setSketchName
     *  setSketchVersion
     *  setValue
     * @param {mysMessage} msg
     */
    sendToController( command, msg ){
        const Msg = this.api().exports().Msg;
        Msg.debug( 'mySensors.sendToController() command='+command, msg );
        this._counters.toController += 1;
        switch( command ){
            case 'createDevice':
                rest.put( this, '/v1/equipment/class/mySensors/'+msg.node_id, msg );
                break;
            default:
                Msg.warn( 'mySensors.sendToController() unknown command='+command );
                break;
        }
    }

    /**
     * @param {mysMessage} msg the message to send
     * @param {*} payload the data to answer
     */
    sendToDevice( msg, payload ){
        const exports = this.api().exports();
        //exports.Msg.debug( 'mySensors.sendToDevice(), msg=', msg );
        msg.sens = mysMessage.c.OUTGOING;
        msg.requestAck();
        msg.setPayload( payload );
        switch( this.feature().config().mySensors.type ){
            case 'mqtt':
                this.IMqttBus.send( msg );
                break;
            case 'net':
                this.INetBus.send( msg );
                break;
            case 'serial':
                this.ISerialBus.send( msg );
                break;
        }
        this._counters.toDevices += 1;
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
