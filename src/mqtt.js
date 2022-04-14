/*
 * mysMqtt MQTT management
 *
 *  mySensors publishes:
 *  - its status to  iztiar/$IZ/mySensors
 *  - its events to iztiar/equipment or iztiar/command
 * 
 *  mySensors accepts same commands than TCP ones in /iztiar/$IZ/mySensors/cmd
 */
import { mysTcp } from "./imports.js";

export const mysMqtt = {

    subscribedTopic: 'iztiar/#',
    publishTopic: 'iztiar/$IZ/',

    // the MqttConnect client connection to iztiar message bus
    connection: null,

    /**
     * @param {mySensors} Instance
     * @param {String} reqTopic
     * @returns {Strig} the topic to be used for the publication
     */
    pubTopic( instance, reqTopic ){
        let _topic = mysMqtt.publishTopic;
        _topic += instance.feature().name();
        if( reqTopic.charAt(0) !== '/' ){
            _topic += '/';
        }
        _topic += reqTopic;
        return _topic;
    },

    /**
     * @param {mySensors} Instance
     * @param {String} topic
     * @param {String} payload
     * @param {Object} options
     */
    publish( instance, topic, payload, options ){
        const Msg = instance.api().exports().Msg;
        if( mysMqtt.connection ){
            const _topic = mysMqtt.pubTopic( instance, topic );
            const _options = {
                ...options
            }
            Object.keys( payload ).every(( k ) => {
                mysMqtt.connection.publish( _topic+'/'+k, payload[k], _options );
                return true;
            })
        } else {
            Msg.warn( 'mysMqtt.publish() no client connection' );
        }
    },

    /**
     * @param {String} topic
     * @param {String} payload
     * Inside of this IMqttClient callback, 'this' is the mySensors instance
     */
    receive( topic, payload ){
        const Msg = this.api().exports().Msg;
        const utils = this.api().exports().utils;
        Msg.debug( 'mysMqtt.receive() topic='+topic, 'payload='+payload );
        const _cmdTopic = mysMqtt.pubTopic( this, '/cmd/' );
        const _payloadStr = payload && payload.toString().length ? JSON.parse( payload ) : "";
        if( topic.startsWith( _cmdTopic )){
            const _command = topic.substring( _cmdTopic.length );
            Msg.debug( 'mysMqtt.receive() command='+_command );
            switch( _command ){
                case 'inclusion':
                    let reply = {
                        verb: _command,
                        timestamp: utils.now(),
                        args: [ _command, _payloadStr ]
                    }
                    mysTcp.inclusionCmd( this, reply );
                    break;
                default:
                    Msg.verbose( 'mysMqtt.receive() unknown command \''+_command+'\'' );
                    break;
            }
        }
    },

    /**
     * @param {mySensors} instance
     */
    start( instance ){
        const Msg = instance.api().exports().Msg;
        Msg.debug( 'mysMqtt.start()' );
        const _clients = instance.IMqttClient.getConnections();
        Object.keys( _clients ).every(( key ) => {
            const _connect = _clients[key];
            const _conf = _connect.config();
            if( _conf.publications.documents ){
                Msg.verbose( 'mqtt.start() identifying \''+key+'\' connection' );
                mysMqtt.connection = _connect;
                mysMqtt.connection.subscribe( mysMqtt.subscribedTopic, instance, mysMqtt.receive );
                return false;
            }
            return true;
        });
    }
};
