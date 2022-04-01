/*
 * mySensorsClass class
 *
 * The class which implements the gateway to MySensors network and devices.
 * See mysensors.routes.js for the needed add-on to the REST API.
 */
import { mySensorsMessage } from './imports.js';

export class mySensorsClass {

    /**
     * Defaults
     */
    static d = {
        listenPort: 24010       // TCP port number for controller -> gateway comm
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
            fn: mySensorsClass._izStatus
        },
        'iz.stop': {
            label: 'stop this mySensors service',
            fn: mySensorsClass._izStop,
            end: true
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
            self.IFeatureProvider.api().exports().Msg.debug( 'mySensorsClass.izStop()', 'replying with', reply );
            return Promise.resolve( reply );
        });
    }

    // when this feature has started
    _started = null;

    // when stopping, the port to which answer and forward the received messages
    _forwardPort = 0;

    // the subscribed-to topic when acting as a MQTT gateway (received messages from the devices)
    _subscribedTopic = null;

    /**
     * @param {engineApi} api the engine API as described in engine-api.schema.json
     * @param {featureCard} card a description of this feature
     * @returns {Promise} which resolves to a mySensorsClass instance
     */
    constructor( api, card ){
        const exports = api.exports();
        const Interface = exports.Interface;
        const Msg = exports.Msg;

        //Interface.extends( this, exports.baseService, api, card );
        Msg.debug( 'mySensorsClass instanciation' );

        // must implement the IFeatureProvider
        //  should implement that first so that we can install the engineApi and the featureCard as soon as possible
        Interface.add( this, exports.IFeatureProvider, {
            v_featureInitialized: this.ifeatureproviderFeatureInitialized,
            v_forkable: this.ifeatureproviderForkable,
            v_killed: this.ifeatureproviderKilled,
            v_start: this.ifeatureproviderStart,
            v_status: this.ifeatureproviderStatus,
            v_stop: this.ifeatureproviderStop
        });
        this.IFeatureProvider.api( api );
        this.IFeatureProvider.feature( card );

        let _promise = this._fillConfig()
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
                    v_terminate: this.iforkableTerminate
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
            .then(() => { return Promise.resolve( this ); });

        return _promise;
    }

    /*
     * @returns {Promise} which resolves to the filled feature configuration
     * Note:
     *  We provide our own default for ITcpServer port to not use the common value
     */
    _fillConfig(){
        if( !this.IFeatureProvider ){
            throw new Error( 'IFeatureProvider is expected to have been instanciated before calling this function' );
        }
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.fillConfig()' );
        const feature = this.IFeatureProvider.feature();
        let _filled = { ...feature.config() };
        if( Object.keys( _filled ).includes( 'ITcpServer' ) && !Object.keys( _filled.ITcpServer ).includes( 'port' )){
            _filled.ITcpServer.port = mySensorsClass.d.listenPort;
        }
        return this.IFeatureProvider.fillConfig( _filled ).then(( c ) => { return feature.config( c ); });
    }

    /*
     * Called on each and every loaded add-on when the main hosting feature has terminated with its initialization
     * Time, for example, to increment all interfaces we are now sure they are actually implemented
     * Here: add verbs to ITcpServer
     */
    ifeatureproviderFeatureInitialized(){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.ifeatureproviderFeatureInitialized()' );
        const self = this;
        Object.keys( mySensorsClass.verbs ).every(( key ) => {
            const o = mySensorsClass.verbs[key];
            self.ITcpServer.add( key, o.label, o.fn, o.end ? o.end : false );
            return true;
        });
    }

    /*
     * @returns {Boolean} true if the process must be forked
     * [-implementation Api-]
     */
    ifeatureproviderForkable(){
        this.IFeatureProvider.api().exports().Msg.debug( 'mySensorsClass.ifeatureproviderForkable()' );
        return true;
    }

    /*
     * If the service had to be SIGKILL'ed to be stoppped, then gives it an opportunity to make some cleanup
     * [-implementation Api-]
     */
    ifeatureproviderKilled(){
        this.IFeatureProvider.api().exports().Msg.debug( 'mySensorsClass.ifeatureproviderKilled()' );
        this.IRunFile.remove( this.IFeatureProvider.feature().name());
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
    ifeatureproviderStart( name, cb, args ){
        const exports = this.IFeatureProvider.api().exports();
        const _forked = exports.IForkable.forkedProcess();
        exports.Msg.debug( 'mySensorsClass.ifeatureproviderStart()', 'forkedProcess='+_forked );
        if( _forked ){
            const featCard = this.IFeatureProvider.feature();
            return Promise.resolve( true )
                .then(() => { this.ITcpServer.create( featCard.config().ITcpServer.port ); })
                .then(() => { exports.Msg.debug( 'mySensorsClass.ifeatureproviderStart() tcpServer created' ); })
                .then(() => { this.IMqttClient.advertise( featCard.config().IMqttClient ); })
                .then(() => { this.mqttSubscribe(); })
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
    ifeatureproviderStatus(){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.ifeatureproviderStatus()' );
        exports.utils.tcpRequest( this.IFeatureProvider.feature().config().ITcpServer.port, 'iz.status' )
            .then(( answer ) => {
                exports.Msg.debug( 'mySensorsClass.ifeatureproviderStatus()', 'receives answer to \'iz.status\'', answer );
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
    ifeatureproviderStop(){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.ifeatureproviderStop()' );
        exports.utils.tcpRequest( this.IFeatureProvider.feature().config().ITcpServer.port, 'iz.stop' )
            .then(( answer ) => {
                exports.Msg.debug( 'mySensorsClass.ifeatureproviderStop()', 'receives answer to \'iz.stop\'', answer );
            }, ( failure ) => {
                // an error message is already sent by the called self.api().exports().utils.tcpRequest()
                //  what more to do ??
                //IMsg.error( 'TCP error on iz.stop command:', failure );
            });
    }

    /*
     * Terminates the child process
     * @returns {Promise} which resolves when the process is actually about to terminate (only waiting for this Promise)
     * [-implementation Api-]
     */
    iforkableTerminate(){
        this.IFeatureProvider.api().exports().Msg.debug( 'mySensorsClass.iforkableTerminate()' );
        return this.terminate();
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
        this.IFeatureProvider.api().exports().Msg.debug( 'mySensorsClass.irunfileRunDir()' );
        return this.IFeatureProvider.api().config().runDir();
    }

    /*
     * What to do when this ITcpServer is ready listening ?
     *  -> write the runfile before advertising parent to prevent a race condition when writing the file
     *  -> send the current service status
     * @param {Object} tcpServerStatus
     * [-implementation Api-]
     */
    itcpserverListening( tcpServerStatus ){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.itcpserverListening()' );
        const featCard = this.IFeatureProvider.feature();
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
     * Internal stats have been modified
     * @param {Object} status of the ITcpServer
     * [-implementation Api-]
     * Note:
     *  As of v0.x, ITcpServer stats are preferably published in the MQTT alive message.
     *  Keep the runfile as light as possible.
     */
    /*
    itcpserverStatsUpdated( status ){
        const featProvider = this.IFeatureProvider;
        featProvider.api().exports().Msg.debug( 'mySensors.itcpserverStatsUpdated()' );
        const _name = featProvider.feature().name();
        this.IRunFile.set([ _name, 'ITcpServer' ], status );
    }
    */

    /*
     * @returns {Promise} which must resolve to an object conform to check-status.schema.json
     */
    checkableStatus(){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.checkableStatus()' );
        const _name = this.IFeatureProvider.feature().name();
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

    /**
     * A message has been received from a device through the MQTT message bus
     * @param {String} topic 
     * @param {String payload 
     */
    mqttReceived( topic, payload ){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.mqttReceived()', 'topic='+topic, 'payload='+payload );
        // if we are here, we are sure we have a 'subscribedTopic'
        const _strmsg = topic.substring( this._subscribedTopic.length-1 ).replace( /\//g, ';' )+';'+JSON.parse( payload );
        exports.Msg.debug( 'mySensorsClass.mqttReceived()', '_strmsg='+_strmsg );
        const _mysmsg = new mySensorsMessage( this.IFeatureProvider, _strmsg );
        // what to do with this message now ?
        // check that nodeid exists if set -> have to map the mySensors nodeid to a Iztiar equipement identifier
        exports.Msg.debug( 'mySensorsClass.mqttReceived()', _mysmsg );
    }

    /**
     * Subscribe to the topics to receive devices messages
     * The root topic to subscribe to is expected to be found in the configuration
     */
    mqttSubscribe(){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.mqttSubscribe()' );
        const _config = this.IFeatureProvider.feature().config();
        if( _config && _config.IMqttClient && _config.IMqttClient.topics && _config.IMqttClient.topics.fromDevices ){
            let _topic = _config.IMqttClient.topics.fromDevices;
            let _last = _topic.charAt( _topic.length-1 );
            if( _last !== '#' ){
                if( _last !== '/'){
                    _topic += '/';
                }
                _topic += '#';
            }
            this.IMqttClient.subscribe( _topic, this, this.mqttReceived );
            this._subscribedTopic = _topic;
        } else {
            exports.Msg.warn( 'mySensorsClass.mqttSubscribe() configuration doesn\'t provide root topic to be subscribed to' );
        }
    }

    /**
     * @returns {Promise} which resolves to a status Object
     * Note:
     *  The object returned by this function (aka the 'status' object) is used:
     *  - as the answer to the 'iz.status' TCP request
     *  - by the IMQttClient when publishing its 'alive' message
     */
    publiableStatus(){
        const exports = this.IFeatureProvider.api().exports();
        const featCard = this.IFeatureProvider.feature();
        const _serviceName = featCard.name();
        exports.Msg.debug( 'mySensorsClass.publiableStatus()', 'serviceName='+_serviceName );
        const self = this;
        let status = {};
        // run-status.schema.json (a bit extended here)
        const _runStatus = function(){
            return new Promise(( resolve, reject ) => {
                if( !self._started ) self._started = exports.utils.now();
                const o = {
                    module: featCard.module(),
                    class: featCard.class(),
                    pids: [ process.pid ],
                    ports: [ featCard.config().ITcpServer.port ],
                    runfile: self.IRunFile.runFile( _serviceName ),
                    started: self._started
                };
                exports.Msg.debug( 'mySensorsClass.publiableStatus()', 'runStatus', o );
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
        const exports = this.IFeatureProvider.api().exports();
        const featCard = this.IFeatureProvider.feature();
        exports.Msg.debug( 'mySensorsClass.terminate()' );
        this.ITcpServer.status().then(( res ) => {
            if( res.status === exports.ITcpServer.s.STOPPING ){
                exports.Msg.debug( 'mySensorsClass.terminate() returning as currently stopping' );
                return Promise.resolve( true );
            }
            if( res.status === exports.ITcpServer.s.STOPPED ){
                exports.Msg.debug( 'mySensorsClass.terminate() returning as already stopped' );
                return Promise.resolve( true );
            }
        });
        const _name = featCard.name();
        const _module = featCard.module();
        this._forwardPort = words && words[0] && self.api().exports().utils.isInt( words[0] ) ? words[0] : 0;

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
            .then(() => {
                // we auto-remove from runfile as late as possible
                //  (rationale: no more runfile implies that the service is no more testable and expected to be startable)
                self.IMqttClient.terminate();
                self.IRunFile.remove( _name );
                exports.Msg.info( _name+' mySensorsClass terminating with code '+process.exitCode );
                return Promise.resolve( true)
                //process.exit();
            });

        return _promise;
    }
}
