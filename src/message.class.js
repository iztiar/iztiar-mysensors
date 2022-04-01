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
 * **The maximum payload size is 25 bytes!**
 * The nRF24L01+ has a maximum of 32 bytes. The MySensors library (version 2.x) uses 7 bytes for the message header.
 * 
 * The ack parameter has the following meaning:
 *      Outgoing: 0 = unacknowledged message, 1 = request ack from destination node,
 *      Incoming: 0 = normal message, 1 = this is an ack message
 */
import { mySensorsConsts } from './imports.js';

export class mySensorsMessage {

    static commandStr( cmd ){
        return mySensorsMessage.str( mySensorsConsts.C, cmd );
    }

    static typeStr( ref, type ){
        return mySensorsMessage.str( ref, type );
    }

    static str( ref, value ){
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

    // internal IFeatureProvider
    _provider = null;

    // message data
    node_id = null;
    sensor_id = null;
    command = null;
    command_str = null;
    ack = null;
    type = null;
    type_str = null;
    payload = null;

    /**
     * Instanciates a new mySensorsMessage
     * @param {IFeatureProvider} provider
     * @param {*} data 
     * @returns {mySensorsMessage}
     * @throws {Error}
     */
    constructor( provider, data ){
        this._provider = provider;
        const exports = provider.api().exports();
        let errs = 0;

        if( data ){
            let strs = data.replace( /\n$/, '' ).split( /\s*;\s*/ );
            if( !strs || strs.length < 5 ){
                exports.Msg.error( 'mySensorsMessage: data=\''+data+'\': invalid message' );
                errs += 1;
            } else {
                this.node_id = strs[0];
                if( !exports.utils.isInt( this.node_id ) || this.node_id > 255 ){
                    exports.Msg.error( 'mySensorsMessage: node_id=\''+this.node_id+'\': invalid value' );
                    errs += 1;
                }
                this.sensor_id = strs[1];
                if( !exports.utils.isInt( this.sensor_id ) || this.sensor_id > 255 ){
                    exports.Msg.error( 'mySensorsMessage: sensor_id=\''+this.sensor_id+'\': invalid value' );
                    errs += 1;
                }
                this.command = strs[2];
                if( !Object.values( mySensorsConsts.C ).includes( this.command )){
                    exports.Msg.error( 'mySensorsMessage: command=\''+this.command+'\': invalid value' );
                    errs += 1;
                } else {
                    this.command_str = mySensorsMessage.commandStr( this.command );
                }
                this.ack = strs[3];
                if( this.ack != '0' && this.ack != '1' ){
                    exports.Msg.error( 'mySensorsMessage: ack=\''+this.ack+'\': invalid value' );
                    errs += 1;
                }
                this.type = strs[4];
                let ref = null;
                switch( this.command ){
                    case mySensorsConsts.C.C_PRESENTATION:
                        ref = mySensorsConsts.S;
                        break;
                    case mySensorsConsts.C.C_SET:
                    case mySensorsConsts.C.C_REQ:
                        ref = mySensorsConsts.V;
                        break;
                    case mySensorsConsts.C.C_INTERNAL:
                        ref = mySensorsConsts.I;
                        break;
                }
                if( ref ){
                    if( !Object.values( ref ).includes( this.type )){
                        exports.Msg.error( 'mySensorsMessage: type=\''+this.type+'\': invalid value' );
                        errs += 1;
                    } else {
                        this.type_str = mySensorsMessage.typeStr( ref, this.type );
                    }
                }
                this.payload = strs[5];
            }
        }
        if( errs ){
            throw new Error( 'mySensorsMessage: unable to instanciate a new object' );
        }
        return this;
    }
}
