/*
 * IMqttBus interface
 *
 *  Address the MQTT devices messages bus
 */
import { mysMessage } from './imports.js';

export class IMqttBus {

    _instance = null;

    // the IMqttClient key which addresses the devices bus
    _key = null;

    // the subscribed topic to receive devices messages
    _subscribedTopic = null;

    // the publish topic  to send messages to the device (/-terminated)
    _publishTopic = null;

    // the IMqttClient connection on the devices bus
    _connection = null;

    /**
     * Constructor
     * @param {*} instance the implementation instance
     * @returns {IMqttBus}
     */
    constructor( instance ){
        instance.api().exports().Msg.debug( 'IMqttBus instanciation' );
        this._instance = instance;
        return this;
    }

    /* *** ***************************************************************************************
       *** The implementation API, i.e; the functions the implementation may want to implement ***
       *** *************************************************************************************** */

    /**
     * @param {mysMessage} msg the received message
     * [-implementation Api-]
     */
    v_incomingMessage( msg ){
        this._instance.api().export().Msg.debug( 'IMqttBus.v_incomingMessage()' );
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
        if( conf.mySensors.type === 'mqtt' ){
            const api = this._instance.api();
            const exports = api.exports();
            exports.Msg.debug( 'IMqttBus.fillConfig()' );

            // subscribed topic
            if( !conf.IMqttBus.fromDevices ){
                throw new Error( 'IMqttBus.fromDevices: configuration not found' );
            }
            this._subscribedTopic = conf.IMqttBus.fromDevices;
            let _last = this._subscribedTopic.charAt( this._subscribedTopic.length-1 );
            if( _last !== '#' ){
                if( _last !== '/'){
                    this._subscribedTopic += '/';
                }
                this._subscribedTopic += '#';
            }
            // publish topic
            if( !conf.IMqttBus.toDevices ){
                throw new Error( 'IMqttBus.toDevices: configuration not found' );
            }
            this._publishTopic = conf.IMqttBus.toDevices;
            _last = this._publishTopic.charAt( this._publishTopic.length-1 );
            if( _last !== '/' ){
                this._publishTopic += '/';
            }
            // IMqttClient key
            if( !conf.IMqttBus.IMqttClient ){
                throw new Error( 'IMqttBus.IMqttClient: configuration not found' );
            }
            this._key = conf.IMqttBus.IMqttClient;
            if( !conf[this._key] ){
                throw new Error( this._key+': configuration not found' );
            }
        }
        return Promise.resolve( conf );
    }

    /**
     * A message has been received from a device through the MQTT message bus
     * @param {String} topic 
     * @param {String payload (may be empty)
     */
    incomingMessages( topic, payload ){
        const exports = this._instance.api().exports();
        exports.Msg.debug( 'IMqttBus.incomingMessages()', 'topic='+topic );
        //exports.Msg.debug( 'mySensors.mqttReceived()', 'topic='+topic, 'payload='+payload );
        // payload may be empty and cannot be JSON.parse'd
        let _strmsg = topic.substring( this._subscribedTopic.length-1 ).replace( /\//g, ';' )+';';
        try {
            _strmsg += JSON.parse( payload || "" );
        } catch( e ){
            exports.Msg.info( 'IMqttBus.incomingMessages()', 'error when parsing payload=\''+payload+'\', making it empty string' );
            _strmsg += "";
        }
        //exports.Msg.debug( 'mySensors.mqttReceived()', '_strmsg='+_strmsg );
        this.v_incomingMessage( new mysMessage().incoming( this._instance, _strmsg ));
    }

    /**
     * send a message to device
     * @param {mysMessage} msg
     */
    send( msg ){
        const exports = this._instance.api().exports();
        let _topic = this._publishTopic;
        _topic += msg.node_id + '/' + msg.sensor_id + '/' + msg.command + '/' + msg.ack + '/' + msg.type;
        exports.Msg.debug( 'IMqttBus.send()', _topic, msg );
        this._connection.publish( _topic, msg.payload );
    }

    /**
     * Start to listen to messages
     * Subscribe to the topics to receive devices messages
     * The root topic to subscribe to is expected to be found in the configuration
     * @param {featureProvider} provider 
     */
    start(){
        this._instance.api().exports().Msg.debug( 'IMqttBus.start()' );
        const _clients = this._instance.IMqttClient.getConnections();
        this._connection = _clients[this._key];
        this._connection.subscribe( this._subscribedTopic, this, this.incomingMessages );
    }
}
