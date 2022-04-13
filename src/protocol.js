/*
 * mySensors class
 *
 * The class which implements the gateway to MySensors network and devices.
 * See mysensors.routes.js for the needed add-on to the REST API.
 */
import { mysConsts, mysMessage, mysRest, mysTcp } from './imports.js';

export const mysProto = {

    /**
     * Deal with messages received from a device: what to do with it?
     *  - either ignore, leaving to the MySensors library the responsability to handle it
     *  - directly answer to the device from the gateway
     *  - forward the information/action to the controlling application
     * @param {mySensors} msg
     * @param {mysMessage} msg
     */
    incomingMessage: function( instance, msg ){
        const Msg = instance.api().exports().Msg;
        Msg.debug( 'mysProto.incomingMessages()', msg );
        if( msg.isIncomingAck()){
            Msg.info( 'mysProto.incomingMessage() ignoring incoming ack message', msg );
        } else {
            switch( msg.command ){
                case mysConsts.C.C_PRESENTATION:
                    mysProto.incomingPresentation( instance, msg );
                    break;
                case mysConsts.C.C_SET:
                    mysProto.incomingSet( instance, msg );
                    break;
                case mysConsts.C.C_REQ:
                    mysProto.incomingReq( instance, msg );
                    break;
                case mysConsts.C.C_INTERNAL:
                    mysProto.incomingInternal( instance, msg );
                    break;
                case mysConsts.C.C_STREAM:
                    exports.Msg.info( 'mySensors.incomingMessage() unexpected command (not the right sens for an OTA firmware update)', msg );
                    break;
                default:
                    exports.Msg.error( 'mySensors.incomingMessage() unknown command', msg );
                    break;
            }
        }
    },

    // C_INTERNAL command
    // some of the internal messages are to be forwarded to the controlling application
    //  while some may be answered by the gateway itself
    //  some are not incoming message at all
    incomingInternal: function( instance, msg ){
        const Msg = instance.api().exports().Msg;
        switch( msg.type ){
            // to be transmitted to the controller
            case mysConsts.I.I_BATTERY_LEVEL:
                mysProto.sendToController( instance, 'setBatteryLevel', msg );
                break;
            // request a new Id from a controller, have to answer to the device
            case mysConsts.I.I_ID_REQUEST:
                mysRest.request( instance, 'GET', '/v1/counter/mySensors/next' ).then(( res ) => {
                    //exports.Msg.debug( 'mySensors.incomingMessages() res='+res );
                    if( res ){
                        msg.setType( mysConsts.I.I_ID_RESPONSE );
                        mysProto.sendToDevice( instance, msg, res.lastId );
                    }
                });
                break;
            // to be answered by the gateway
            case mysConsts.I.I_TIME:
                mysProto.sendToDevice( instance, msg, Date.now());
                break;
            // to be answered by the gateway
            case mysConsts.I.I_CONFIG:
                mysProto.sendToDevice( instance, msg, instance.feature().config().mySensors.config );
                break;
            // to be dealed with by the gateway
            case mysConsts.I.I_LOG_MESSAGE:
                exports.Logger.info( 'mySensors.incomingMessage()', msg );
                break;
            case mysConsts.I.I_SKETCH_NAME:
                if( mysTcp.inclusionMode() && msg.sensor_id === '255' ){
                    mysRest.request( instance, 'PUT', '/v1/equipment/class/mySensors/'+msg.node_id+'/add', {
                            mySensors: {
                                sketchName: msg.payload
                            }
                    }).then(( res ) => {
                        exports.Msg.debug( 'mySensors.incomingMessages() res=', res );
                        mysTcp.inclusionCacheAdd( instance, msg.node_id, res );
                    });
                } else {
                    exports.Msg.info( 'mySensors.incomingMessage() ignoring presentation message while not in inclusion mode', msg );
                }
                break;
            case mysConsts.I.I_SKETCH_VERSION:
                if( mysTcp.inclusionMode() && msg.sensor_id === '255' ){
                    mysRest.request( instance, 'PUT', '/v1/equipment/class/mySensors/'+msg.node_id+'/add', {
                            mySensors: {
                                sketchVersion: msg.payload
                            }
                    }).then(( res ) => {
                        exports.Msg.debug( 'mySensors.incomingMessages() res=', res );
                        mysTcp.inclusionCacheAdd( instance, msg.node_id, res );
                    });
                } else {
                    exports.Msg.info( 'mySensors.incomingMessage() ignoring presentation message while not in inclusion mode', msg );
                }
                break;
            // to be dealed with by the gateway
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
                exports.Msg.info( 'mysProto.incomingInternal() ignoring unexpected internal message', msg );
                break;
            default:
                exports.Msg.error( 'mysProto.incomingInternal() ignoring unknown type', msg );
                break;
        }
    },

    // presentation message are sent by the device on each boot of the device
    //  instance is a good time to register them in the controller application (as far as we are in inclusion mode)
    //  we buffer all these messages, sending the total to the controller when we thing we have all received
    incomingPresentation: function( instance, msg ){
        const Msg = instance.api().exports().Msg;
        if( mysTcp.inclusionMode()){

            // create/set the node
            if( msg.sensor_id === '255' ){
                mysRest.request( instance, 'PUT', '/v1/equipment/class/mySensors/'+msg.node_id+'/add', {
                    mySensors: {
                        nodeType: msg.type_str,
                        libVersion: msg.payload
                    }
                }).then(( res ) => {
                    Msg.debug( 'mysProto.incomingPresentation() res=', res );
                    mysTcp.inclusionCacheAdd( instance, msg.node_id, res );
                });

            // create/set a command
            } else {
                const _equip = mysTcp.inclusionCacheGet( instance, msg.node_id );
                if( _equip ){
                    let _payload = {
                        mySensors: {
                            sensorType: msg.type_str
                        }
                    };
                    if( msg.payload && msg.payload.length ){
                        _payload.mySensors.sensorName = msg.payload;
                    }
                    mysRest.request( instance, 'PUT', '/v1/command/equipment/'+_equip.equipId+'/'+msg.sensor_id, _payload )
                        .then(( res ) => {
                            Msg.debug( 'mysProto.incomingPresentation() res=', res );
                        });
                } else {
                    Msg.info( 'mysProto.incomingPresentation() ignoring sensor presentation message as node is unknown', msg );
                }
            }
        } else {
            Msg.info( 'mysProto.incomingPresentation() ignoring presentation message while not in inclusion mode', msg );
        }
    },

    // C_REQ command
    incomingReq: function( instance, msg ){
        const Msg = instance.api().exports().Msg;
        mysProto.sendToController( instance, 'requestValue', msg );
    },

    // C_SET command
    incomingSet: function( instance, msg ){
        const Msg = instance.api().exports().Msg;
        mysProto.sendToController( instance, 'setValue', msg );
    },

    /**
     * @param {mySensors} instance
     * @param {String} command
     *  requestValue
     *  setBatteryLevel
     *  setValue
     * @param {mysMessage} msg
     */
    sendToController( instance, command, msg ){
        const Msg = instance.api().exports().Msg;
        Msg.debug( 'mySensors.sendToController() command='+command, msg );
        instance._counters.toController += 1;
        switch( command ){
            case 'createDevice':
                mysRest.put( instance, '/v1/equipment/class/mySensors/'+msg.node_id, msg );
                break;
            default:
                Msg.warn( 'mySensors.sendToController() unknown command='+command );
                break;
        }
    },

    /**
     * @param {mySensors} instance
     * @param {mysMessage} msg the message to send
     * @param {*} payload the data to answer
     */
    sendToDevice( instance, msg, payload ){
        const Msg = instance.api().exports().Msg;
        msg.sens = mysMessage.c.OUTGOING;
        msg.requestAck();
        msg.setPayload( payload );
        switch( instance.feature().config().mySensors.type ){
            case 'mqtt':
                instance.IMqttBus.send( msg );
                break;
            case 'net':
                instance.INetBus.send( msg );
                break;
            case 'serial':
                instance.ISerialBus.send( msg );
                break;
        }
        instance._counters.toDevices += 1;
    }
}
