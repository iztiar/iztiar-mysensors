/*
 * mySensorsClass class
 *
 * The class which implements the gateway to MySensors network and devices.
 * See mysensors.routes.js for the needed add-on to the REST API.
 */
import { mysConsts } from './consts.js';
import { mysMessage } from './imports.js';

export class mySensorsClass {

    /**
     * Defaults
     */
    static d = {
        listenPort: 24010,       // TCP port number for controller -> gateway comm
        gwport: 24009,           // TCP port for net gateway -> devices
        gwhost: 'localhost',
        gwusb: '/dev/usb',
        config: 'M'
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
        },
        'mySensors': {
            label: 'mySensors command',
            fn: mySensorsClass._mySensorsCmd
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

    // a 'mySensors' command received from the application
    static _mySensorsCmd( self, reply ){
        if( reply.args.length >= 1 ){
            const _args1 = reply.args.length >= 2 ? reply.args[1] : null;
            switch( reply.args[0] ){

                // inclusion on|off
                case 'inclusion':
                    if( _args1 === 'on' || _args1 === 'off' ){
                        self._inclusionMode = ( _args1 === 'on' );
                        reply.answer = { inclusion: _args1 };
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

    // when stopping, the port to which answer and forward the received messages
    _forwardPort = 0;

    // mqtt data
    // the subscribed-to topics when acting as a MQTT gateway (received messages from the devices)
    _mqttSubscribedTopic = null;
    _mqttKey = null;
    _mqttConnection = null;
    _mqttPublishTopic = null;

    // is inclusion mode
    _inclusionMode = false;

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
        if( !_filled.mySensors ){
            throw new Error( 'mySensorsClass expects a \'mySensors\' configuration group' );
        }
        if( _filled.mySensors.type !== 'mqtt' && _filled.mySensors.type !== 'net' && _filled.mySensors.type !== 'serial' ){
            throw new Error( 'mySensorsClass expects a \'mySensors.type\' gateway type, found \''+_filled.mySensors.type+'\'' );
        }
        if( !_filled.mySensors.config ){
            _filled.mySensors.config = mySensorsClass.d.config;
        }
        // depending of the mySensors gateway type, we must have an ad-hoc configuration group
        let _found = false;
        const _starts = 'IMqttClient.';
        Object.keys( _filled ).every(( k ) => {
            switch( _filled.mySensors.type ){
                case 'mqtt':
                    if( k.startsWith( _starts )){
                        if( _filled[k].topics && _filled[k].topics.fromDevices && _filled[k].topics.toDevices ){
                            _found = true;
                            this._mqttKey = k;
                            this._mqttPublishTopic = _filled[k].topics.toDevices;
                            let _last = this._mqttPublishTopic.charAt( this._mqttPublishTopic.length-1 );
                            if( _last !== '/' ){
                                this._mqttPublishTopic += '/';
                            }
                            return false;
                        }
                    }
                    break;
                case 'net':
                    if( k === 'net' ){
                        _found = true;
                        if( !_filled.net.host ){
                            _filled.net.host = mySensorsClass.d.gwhost;
                        }
                        if( !_filled.net.port ){
                            _filled.net.port = mySensorsClass.d.gwport;
                        }
                        return false;
                    }
                    break;
                case 'serial':
                    if( k === 'serial' ){
                        _found = true;
                        if( !_filled.serial.port ){
                            _filled.serial.port = mySensorsClass.d.gwusb;
                        }
                        return false;
                    }
                    break;
            }
            return true;
        });
        if( !_found ){
            throw new Error( 'mySensorsClass expects a configuration group for \''+_filled.mySensors.type+'\' which was not found' );
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
                .then(() => { this.IMqttClient.connects(); })
                .then(() => {
                    switch( featCard.config().mySensors.type ){
                        case 'mqtt':
                            this.mqttSubscribe();
                            break;
                        case 'net':
                            exports.Msg.debug( 'mySensorsClass.ifeatureproviderStart()', 'type \'net\' not implemented' );
                            break;
                        case 'serial':
                            exports.Msg.debug( 'mySensorsClass.ifeatureproviderStart()', 'type \'serial\' not implemented' );
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
     * Deal with messages received from a device: what to do with it?
     *  - either ignore, leaving to the MySensors library the responsability to handle it
     *  - directly answer to the device from the gateway
     *  - forward the information/action to the controlling application
     * @param {mysMessage} msg
     */
    incomingMessage( msg ){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.incomingMessages()', msg );
        if( msg.isIncomingAck()){
            exports.Msg.info( 'mySensorsClass.incomingMessage() ignoring incoming ack message', msg );
        } else {
            switch( msg.command ){
                // presentation message are sent by the device on each boot of the device
                //  this is a good time to register them in the controller application (as far as as we are in inclusion mode)
                case mysConsts.C.C_PRESENTATION:
                    if( this._inclusionMode ){
                        this.sendToController( 'createDevice', msg );
                    } else {
                        exports.Msg.info( 'mySensorsClass.incomingMessage() ignoring presentation message while not in inclusion mode', msg );
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
                            this.reqAnswerFromController( 'getNextId', msg );
                            break;
                        // to be answered by the gateway
                        case mysConsts.I.I_TIME:
                            this.sendToDevice( msg, Date.now());
                            break;
                        case mysConsts.I.I_VERSION:
                            this.sendToDevice( msg, this.IFeatureProvider.feature().packet().getVersion());
                            break;
                        case mysConsts.I.I_CONFIG:
                            this.sendToDevice( msg, this.IFeatureProvider.feature().config().mySensors.config );
                            break;
                        case mysConsts.I.I_LOG_MESSAGE:
                            exports.Logger.info( 'mySensorsClass.incomingMessage()', msg );
                            break;
                        case mysConsts.I.I_SKETCH_NAME:
                            this.sendToController( 'setSketchName', msg );
                            break;
                        case mysConsts.I.I_SKETCH_VERSION:
                            this.sendToController( 'setSketchVersion', msg );
                            break;
                        case mysConsts.I.I_DEBUG:
                            exports.Logger.debug( 'mySensorsClass.incomingMessage()', msg );
                            break;
                        // these messages should never be incoming or are just ignored
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
                            exports.Msg.info( 'mySensorsClass.incomingMessage() ignoring unexpected internal message', msg );
                            break;
                        default:
                            exports.Msg.error( 'mySensorsClass.incomingMessage() unknown type', msg );
                            break;
                    }
                    break;
                case mysConsts.C.C_STREAM:
                    exports.Msg.info( 'mySensorsClass.incomingMessage() unexpected command (not the right sens for an OTA firmware update)', msg );
                    break;
                default:
                    exports.Msg.error( 'mySensorsClass.incomingMessage() unknown command', msg );
                    break;
            }
        }
    }

    /**
     * send a message to device
     * @param {mysMessage} msg
     */
    mqttPublish( msg ){
        const exports = this.IFeatureProvider.api().exports();
        let _topic = this._mqttPublishTopic;
        _topic += msg.node_id + '/' + msg.sensor_id + '/' + msg.command + '/' + msg.ack + '/' + msg.type;
        exports.Msg.debug( 'mySensorsClass.mqttPublish()', _topic, msg );
        this._mqttConnection.publish( _topic, msg.payload );
    }

    /**
     * A message has been received from a device through the MQTT message bus
     * @param {String} topic 
     * @param {String payload (may be empty)
     */
    mqttReceived( topic, payload ){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.mqttReceived()', 'topic='+topic );
        //exports.Msg.debug( 'mySensorsClass.mqttReceived()', 'topic='+topic, 'payload='+payload );
        // payload may be empty and cannot be JSON.parse'd
        let _strmsg = topic.substring( this._mqttSubscribedTopic.length-1 ).replace( /\//g, ';' )+';';
        try {
            _strmsg += JSON.parse( payload || "" );
        } catch( e ){
            exports.Msg.info( 'mySensorsClass.mqttReceived()', 'error when parsing payload=\''+payload+'\', making it empty string' );
            _strmsg += "";
        }
        //exports.Msg.debug( 'mySensorsClass.mqttReceived()', '_strmsg='+_strmsg );
        const _mysmsg = new mysMessage().incoming( this.IFeatureProvider, _strmsg );
        // what to do with this message now ?
        this.incomingMessage( _mysmsg );
    }

    /**
     * Subscribe to the topics to receive devices messages
     * The root topic to subscribe to is expected to be found in the configuration
     * _mqttKey has been set at fillConfig() time
     */
    mqttSubscribe(){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.mqttSubscribe()' );
        const _config = this.IFeatureProvider.feature().config();
        let _topic = _config[this._mqttKey].topics.fromDevices;
        let _last = _topic.charAt( _topic.length-1 );
        if( _last !== '#' ){
            if( _last !== '/'){
                _topic += '/';
            }
            _topic += '#';
        }
        const _clients = this.IMqttClient.getConnections();
        _clients[this._mqttKey].subscribe( _topic, this, this.mqttReceived );
        this._mqttSubscribedTopic = _topic;
        this._mqttConnection = _clients[this._mqttKey];
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
     * @param {String} command
     *  GetNextId
     * @param {mysMessage} msg
     */
    reqAnswerFromController( command, msg ){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.reqAnswerFromController() command='+command, msg );
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
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.sendToController() command='+command, msg );
    }

    /**
     * @param {mysMessage} msg the received message to be answered to
     * @param {*} payload the data to answer
     */
    sendToDevice( msg, payload ){
        const exports = this.IFeatureProvider.api().exports();
        exports.Msg.debug( 'mySensorsClass.sendToDevice()' );
        let _answer = new mysMessage();
        _answer.copy( msg );
        _answer.sens = mysMessage.c.OUTGOING;
        _answer.requestAck();
        _answer.setPayload( payload );
        switch( this.IFeatureProvider.feature().config().mySensors.type ){
            case 'mqtt':
                this.mqttPublish( _answer );
                break;
            case 'net':
            case 'serial':
                break;
        }
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
