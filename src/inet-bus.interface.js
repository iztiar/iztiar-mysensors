/*
 * INetBus interface
 *
 *  Address devices through a remote TCP port
 */
import net from 'net';

import { mysMessage } from './imports.js';

export class INetBus {

    /**
     * Defaults
     */
    static d = {
        host: 'localhost',
        port: 24009
    };

    _instance = null;

    // the remote connection
    _connection = null;

    /**
     * Constructor
     * @param {*} instance the implementation instance
     * @returns {INetBus}
     */
    constructor( instance ){
        instance.api().exports().Msg.debug( 'INetBus instanciation' );
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
        exports.Msg.debug( 'INetBus._receive()', 'str='+_strmsg );
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
        this._instance.api().export().Msg.debug( 'INetBus.v_incomingMessage()' );
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
            exports.Msg.debug( 'INetBus.fillConfig()' );
            // host
            if( !conf.INetBus.host ){
                conf.INetBus.host = INetBus.d.host;
            }
            // port
            if( !conf.INetBus.port ){
                conf.INetBus.port = INetBus.d.port;
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
        exports.Msg.debug( 'INetBus.send()', _strmsg );
        if( this._connection ){
            this._connection.write( _strmsg+'\n' );
        }
    }

    /**
     * Start to listen to messages
     */
    start(){
        const Msg = this._instance.api().exports().Msg;
        Msg.debug( 'INetBus.start()' );
        const _conf = this._instance.feature().config().INetBus;
        try {
            this._connection = net.createConnection({ host:_conf.host, port:_conf.port, family:4 }, () => {
                Msg.verbose( 'INetBus.start() successfully connected to '+_conf.host+':'+_conf.port );
            });
            this._connection.on( 'data', ( data ) => {
                const _bufferStr = new Buffer.from( data ).toString();
                Msg.debug( 'INetBus.start() receives '+_bufferStr );
                this._receive( _bufferStr );
            });
            this._connection.on( 'error', ( e ) => {
                Msg.error( 'INetBus.start().on(\'error\') ', e.name, e.code, e.message );
            });
            //client.on( 'end', ( m ) => {
            //    Msg.debug( 'utils.tcpRequest().on(\'end\'): client connection ended', m );
            //    resolve( true );
            //});
        } catch( e ){
            Msg.error( 'INetBus.start().catch()', e.name, e.message );
        }
    }

    /**
     * Terminate the connection
     */
    terminate(){
        this._instance.api().exports().Msg.debug( 'INetBus.terminate()' );
    }
}
