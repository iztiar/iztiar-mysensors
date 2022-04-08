/*
 * ISerialBus interface
 *
 *  Address devices through a local USB port
 */
import serialPort from 'serialport';

import { mysMessage } from './imports.js';

export class ISerialBus {

    /**
     * Defaults
     */
    static d = {
        port: '/dev/usb'
    };

    _instance = null;

    // the remote connection
    _connection = null;

    /**
     * Constructor
     * @param {*} instance the implementation instance
     * @returns {ISerialBus}
     */
    constructor( instance ){
        instance.api().exports().Msg.debug( 'ISerialBus instanciation' );
        this._instance = instance;
        return this;
    }

    /**
     * A message has been received from a device through the net connection
     * @param {String} str
     */
    _receive( str ){
        let _strmsg = str.replace( /[\r\n]/g, '' );
        const exports = this._instance.api().exports();
        exports.Msg.debug( 'ISerialBus._receive()', 'str='+_strmsg );
        this.v_incomingMessage( new mysMessage().incoming( this._instance, _strmsg ));
    }

    /* *** ***************************************************************************************
       *** The implementation API, i.e; the functions the implementation may want to implement ***
       *** *************************************************************************************** */

    /**
     * @param {mysMessage} msg the received message
     * [-implementation Api-]
     */
    v_incomingMessage( msg ){
        this._instance.api().export().Msg.debug( 'ISerialBus.v_incomingMessage()' );
    }

    /* *** ***************************************************************************************
       *** The public API, i.e; the API anyone may call to access the interface service        ***
       *** *************************************************************************************** */

    /**
     * Fill the configuration for this interface
     * @param {Object} conf the full feature configuration
     * @returns {Promise} which resolves to the filled interface configuration
     */
    fillConfig( conf ){
        if( conf.mySensors.type === 'net' ){
            const api = this._instance.api();
            const exports = api.exports();
            exports.Msg.debug( 'ISerialBus.fillConfig()' );
            // port
            if( !conf.ISerialBus.port ){
                conf.ISerialBus.port = ISerialBus.d.port;
            }
        }
        return Promise.resolve( conf );
    }

    /**
     * send a message to device
     * @param {mysMessage} msg
     */
    send( msg ){
        const exports = this._instance.api().exports();
        const _strmsg = msg.node_id + ';' + msg.sensor_id + ';' + msg.command + ';' + msg.ack + ';' + msg.type + ';' + JSON.stringify( msg.payload );
        exports.Msg.debug( 'ISerialBus.send()', _strmsg );
        if( this._connection ){
            this._connection.write( _strmsg+'\n' );
        }
    }

    /**
     * Start to listen to messages
     */
    start(){
        const Msg = this._instance.api().exports().Msg;
        Msg.debug( 'ISerialBus.start()' );
        const _conf = this._instance.feature().config().ISerialBus;
        try {
            this._connection = new serialPort({ path: _conf.port, baudRate: 115200 });
            this._connection.on( 'open', () => {
                Msg.verbose( 'ISerialBus.start() successfully connected to '+_conf.port );
            })
            this._connection.on( 'data', ( data ) => {
                const _bufferStr = new Buffer.from( data ).toString();
                Msg.debug( 'ISerialBus.start() receives '+_bufferStr );
                this._receive( _bufferStr );
            });
            this._connection.on( 'error', ( e ) => {
                Msg.error( 'ISerialBus.start().on(\'error\') ', e.name, e.code, e.message );
            });
        } catch( e ){
            Msg.error( 'ISerialBus.start().catch()', e.name, e.message );
        }
    }

    /**
     * Terminate the connection
     */
    terminate(){
        this._instance.api().exports().Msg.debug( 'ISerialBus.terminate()' );
    }
}
