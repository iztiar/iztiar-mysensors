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
    publishTopic: 'iztiar/$IZ/mySensors',

    // the MqttConnect client connection to iztiar message bus
    connection: null,

    /**
     * @param {mySensors} Instance
     * @param {String} topic
     * @param {String} payload
     */
    publish( instance, topic, payload ){
        const Msg = instance.api().exports().Msg;
        if( mysMqtt.connection ){
            let _topic = mysMqtt.publishTopic;
            if( topic.charAt(0) !== '/' ){
                _topic += '/';
            }
            _topic += topic;
            mysMqtt.connection.publish( _topic, payload, { retain: true });
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
        const _cmdTopic = mysMqtt.publishTopic+'/cmd/';
        const _payloadStr = JSON.parse( payload );
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
        instance.api().exports().Msg.debug( 'mysMqtt.start()' );
        const _clients = instance.IMqttClient.getConnections();
        const _conf = instance.feature().config();
        if( _clients[_conf.izMqtt] ){
            mysMqtt.connection = _clients[_conf.izMqtt];
            mysMqtt.connection.subscribe( mysMqtt.subscribedTopic, instance, mysMqtt.receive );
        }
    }
};
