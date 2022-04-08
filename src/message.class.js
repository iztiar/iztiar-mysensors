/*
 * message class
 *
 * A JS implementation of the MySensors serial message
 *
 * See https://www.mysensors.org/download/serial_api_20
 * 
 * Message Structure
 * The serial protocol used between the Gateway and the Controller is a simple semicolon separated list of values.
 * The last part of each "command" is the payload.
 * All commands ends with a newline.
 * The serial commands has the following format:
 * 
 *      node-id ; child-sensor-id ; command ; ack ; type ; payload \n
 * 
 * The maximum payload size is 25 bytes!
 * The nRF24L01+ has a maximum of 32 bytes. The MySensors library (version 2.x) uses 7 bytes for the message header.
 * 
 * The ack parameter has the following meaning:
 *      Outgoing: 0 = unacknowledged message, 1 = request ack from destination node,
 *      Incoming: 0 = normal message, 1 = this is an ack message
 */
import { mysConsts } from './imports.js';

export class mysMessage {

    static c = {
        INCOMING: 'incoming',   // from the device to the controller
        OUTGOING: 'outgoing'    // from the controller to the device
    };

    static _str( ref, value ){
        let _key = null;
        Object.keys( ref ).every(( k ) => {
            if( ref[k] === value ){
                _key = k;
                return false;
            }
            return true;
        });
        return _key;
    }

    // message data
    node_id = null;
    sensor_id = null;
    command = null;
    command_str = null;
    ack = null;
    type = null;
    type_str = null;
    payload = null;
    sens = null;

    /**
     * @param {mysMessage|null} msg a message
     * @returns {mysMessage} a new mysMessage, maybe copied from  msg
     */
    constructor( msg=null ){
        if( msg ){
            this.node_id = msg.node_id;
            this.sensor_id = msg.sensor_id;
            this.command = msg.command;
            this.command_str = msg.command_str;
            this.ack = msg.ack;
            this.type = msg.type;
            this.type_str = msg.type_str;
            this.payload = msg.payload;
            this.sens = msg.sens;
        }
    }

    /**
     * Initialize an incoming message
     * @param {featureProvider} provider
     * @param {*} data the serial string semi-comma-separated message
     * @returns {mysMessage}
     * @throws {Error}
     */
    incoming( provider, data ){
        const exports = provider.api().exports();
        let errs = 0;
        if( data ){
            let strs = data.replace( /\n$/, '' ).split( /\s*;\s*/ );
            if( !strs || strs.length < 5 ){
                exports.Msg.error( 'mysMessage: data=\''+data+'\': invalid message' );
                errs += 1;
            } else {
                this.node_id = strs[0];
                if( !exports.utils.isInt( this.node_id ) || this.node_id > 255 ){
                    exports.Msg.error( 'mysMessage: node_id=\''+this.node_id+'\': invalid value' );
                    errs += 1;
                }
                this.sensor_id = strs[1];
                if( !exports.utils.isInt( this.sensor_id ) || this.sensor_id > 255 ){
                    exports.Msg.error( 'mysMessage: sensor_id=\''+this.sensor_id+'\': invalid value' );
                    errs += 1;
                }
                this.command = strs[2];
                if( !Object.values( mysConsts.C ).includes( this.command )){
                    exports.Msg.error( 'mysMessage: command=\''+this.command+'\': invalid value' );
                    errs += 1;
                } else {
                    this.command_str = mysMessage._str( mysConsts.C, this.command );
                }
                this.ack = strs[3];
                if( this.ack !== '0' && this.ack !== '1' ){
                    exports.Msg.error( 'mysMessage: ack=\''+this.ack+'\': invalid value' );
                    errs += 1;
                }
                this.type = strs[4];
                let ref = null;
                switch( this.command ){
                    case mysConsts.C.C_PRESENTATION:
                        ref = mysConsts.S;
                        break;
                    case mysConsts.C.C_SET:
                    case mysConsts.C.C_REQ:
                        ref = mysConsts.V;
                        break;
                    case mysConsts.C.C_INTERNAL:
                        ref = mysConsts.I;
                        break;
                }
                if( ref ){
                    if( !Object.values( ref ).includes( this.type )){
                        exports.Msg.error( 'mysMessage: type=\''+this.type+'\': invalid value' );
                        errs += 1;
                    } else {
                        this.type_str = mysMessage._str( ref, this.type );
                    }
                }
                this.payload = strs[5];
                this.sens = mysMessage.c.INCOMING;
            }
        }
        if( errs ){
            throw new Error( 'mysMessage: unable to instanciate the object' );
        }
        return this;
    }

    /**
     * @returns {Boolean} true if the message is a received acknowledge
     */
    isIncomingAck(){
        return this.sens === mysMessage.c.INCOMING && this.ack === '1';
    }

    /**
     * on outgoing messages, request an acknowledge
     */
    requestAck(){
        this.ack = '1';
    }

    /**
     * @param {*} data set the payload of the message
     */
    setPayload( data ){
        let _str = data ? data.toString() : "";
        if( _str.length > 25 ){
            _str = _str.substring( 0, 25 );
        }
        this.payload = _str;
    }

    /**
     * @param {String} type the type of the message to be set
     * @param {featureProvider} provider
     */
    setType( type, provider=null ){
        let ref = null;
        this.type = type;
        if( provider ){
            provider.api().exports().Msg.debug( 'mysMessage.setType() '+type );
        }
        switch( this.command ){
            case mysConsts.C.C_PRESENTATION:
                ref = mysConsts.S;
                break;
            case mysConsts.C.C_SET:
            case mysConsts.C.C_REQ:
                ref = mysConsts.V;
                break;
            case mysConsts.C.C_INTERNAL:
                ref = mysConsts.I;
                break;
        }
        if( provider ){
            provider.api().exports().Msg.debug( 'mysMessage.setType() chosen ref is', ref );
        }
        if( ref ){
            this.type_str = mysMessage._str( ref, this.type );
            if( provider ){
                provider.api().exports().Msg.debug( 'mysMessage.setType() type_str=', this.type_str );
            }
        }
        return this;
    }
}
