/*
 * mysTcp: manage the TCP commands
 */

import { mysMqtt } from "./imports.js";

export const mysTcp = {

    // inclusion mode
    // + keep a cache of mySensors vs. controller data
    //      so that we are able to associate a nodeid with an equipId
    //      though this requires that C_PRESENTATION node messages have been seen before C_PRESENTATION sensors messages
    //  index: node_id
    //  data: { name, equipId }
    //  the cache is reset on inclusion mode stop only
    inclusion: {
        mode: false,
        tsStarted: null,
        timeoutId: null,
        tsEnding: null,
        cache: {}
    },

    /**
     * The commands which can be received by this mySensors service via the TCP communication port
     * - keys are the commands
     *   > label {string} a short help message
     *   > fn {Function} the execution function (cf. above)
     *   > endConnection {Boolean} whether the server should close the client connection
     *      alternative being to wait for the client closes itself its own connection
     */
    verbs: {
        'iz.status': {
            label: 'return the status of this mySensors service',
            fn: 'izStatus'
        },
        'iz.stop': {
            label: 'stop this mySensors service',
            fn: 'izStop',
            end: true
        },
        'mySensors': {
            label: 'mySensors gateway management',
            fn: 'mySensorsCmd'
        }
    },

    // returns the full status of the server
    izStatus: function( instance, reply ){
        return instance.publiableStatus()
            .then(( status ) => {
                reply.answer = status;
                return Promise.resolve( reply );
            });
    },

    // terminate the server and its relatives
    izStop: function( instance, reply ){
        instance.terminate( reply.args, ( res ) => {
            reply.answer = res;
            instance.api().exports().Msg.debug( 'mysTcp.izStop()', 'replying with', reply );
            return Promise.resolve( reply );
        });
        return Promise.resolve( true );
    },

    // a 'mySensors' command received from the application
    mySensorsCmd: function( instance, reply ){
        instance._counters.fromController += 1;
        if( reply.args.length >= 1 ){
            switch( reply.args[0] ){

                // inclusion on|off|null
                case 'inclusion':
                    mysTcp.inclusionCmd( instance, reply );
                    break;

                default:
                    reply.answer = "unknown '"+reply.args[0]+"' mySensors command";
                    break;
            }
        } else {
            reply.answer = "mySensors command expects at least one argument";
        }
        return Promise.resolve( reply );
    },

    // Accepted syntax:
    //  inclusion       -> returns the current status of the inclusion mode
    //  inclusion on    -> set the inclusion + returns the current status
    //  inclusion off   -> clear the inclusion + returns the current status
    inclusionCmd: function( instance, reply ){
        const Msg = instance.api().exports().Msg;
        const _arg1 = reply.args.length >= 2 ? reply.args[1] : null;
        Msg.debug( 'mysTcp.inclusionCmd() reply=', reply );
        Msg.debug( 'mysTcp.inclusionCmd() arg1='+_arg1 );

        // set the inclusion mode if asked for
        if( _arg1 === 'on' || _arg1 === 'off' ){
            mysTcp.inclusionSet( instance, _arg1 === 'on' );
        }

        // return an extended inclusion status
        const _delay = instance.feature().config().mySensors.inclusionDelay;
        if( _arg1 === 'on' || _arg1 === 'off' || !_arg1 ){
            reply.answer = mysTcp.inclusionStatus( instance );
            reply.answer.delay = _delay;
            // and publish the new inclusion status
            mysMqtt.publish( instance, 'inclusion/status', mysTcp.inclusionStatus( instance ));
            mysMqtt.publish( instance, 'inclusion/conf', mysTcp.inclusionConfig( instance ));

        } else {
            reply.answer = "mySensors 'inclusion' command expects one 'on|off' argument, '"+_arg1+"' found";
        }
    },

    /**
     * @param {mySensors} instance
     * @param {String} nodeid
     * @param {Object} res the request
     */
    inclusionCacheAdd: function( instance, nodeid, res ){
        const Msg = instance.api().exports().Msg;

        if( Object.keys( mysTcp.inclusion.cache ).includes( nodeid )){
            Msg.debug( 'mysTcp.inclusionCacheAdd() nodeid='+nodeid+' already set' );

        } else if( res.OK ){
            const _data = { name: res.OK.name, equipId: res.OK.equipId };
            mysTcp.inclusion.cache[nodeid] = _data;
            Msg.debug( 'mysTcp.inclusionCacheAdd() nodeid='+nodeid, _data );

        } else {
            Msg.error( 'mysTcp.inclusionCacheAdd() nodeid='+nodeid, 'res=', res );
        }
    },

    /**
     * @param {mySensors} instance
     * @param {String} nodeid
     */
    inclusionCacheGet: function( instance, nodeid ){
        return mysTcp.inclusion.cache[nodeid] || null;
    },

    /**
     * @param {mySensors} instance
     * @returns {Object} inclusion configuration
     */
    inclusionConfig( instance ){
        const config = instance.feature().config();
        return {
            inclusionDelay: config.mySensors.inclusionDelay,
            inclusionAdvertise: config.mySensors.inclusionAdvertise,
        }
    },

    /**
     * @returns {Boolean} whether the inclusion mode is currently activated
     */
    inclusionMode: function(){
        return mysTcp.inclusion.mode === true;
    },

    /**
     * @param {mySensors} instance
     * @param {Boolean} set whether to start (true) or stop the inclusion mode
     *  started is only reset on 'off->on' transitions, not on 'on->on'
     *  cache is never reset
     */
    inclusionSet( instance, set=false ){
        const Msg = instance.api().exports().Msg;
        Msg.debug( 'mysTcp.inclusionMode() set='+set );

        // inclusion mode reinit
        const _fClear = function(){
            if( mysTcp.inclusion.timeoutId ){
                clearTimeout( mysTcp.inclusion.timeoutId );
                mysTcp.inclusion.timeoutId = null;
            }
        };

        const _previous = mysTcp.inclusion.mode;
        mysTcp.inclusion.mode = set;
        _fClear();

        // setting the inclusion mode on while already in inclusion mode reset the timeout, but not the cache
        if( set ){
            const ts = Date.now();
            const delay = instance.feature().config().mySensors.inclusionDelay;
            mysTcp.inclusion.timeoutId = setTimeout( mysTcp.inclusionSet, delay, instance, false );
            mysTcp.inclusion.tsEnding = ts+delay;
            if( !_previous ){
                mysTcp.inclusion.tsStarted = ts;
            }
        }
    },

    /**
     * @param {mySensors} instance
     * @returns {Object} inclusion current status
     */
    inclusionStatus( instance ){
        const utils = instance.api().exports().utils;
        let s = {
            inclusion: mysTcp.inclusion.mode ? 'on':'off',
            known: mysTcp.inclusion.cache
        };
        if( mysTcp.inclusion.mode ){
            s.started = utils.humanStamp( mysTcp.inclusion.tsStarted );
            s.ending = utils.humanStamp( mysTcp.inclusion.tsEnding );
        }
        return s;
    },

    /**
     * Called by mySensors.ready()
     * @param {mySensors} instance
     */
    ready( instance ){
        instance.api().exports().Msg.debug( 'mysTcp.ready()' );
        // define add-on verbs to ITcpServer
        Object.keys( mysTcp.verbs ).every(( key ) => {
            const o = mysTcp.verbs[key];
            instance.ITcpServer.add( key, o.label, mysTcp[o.fn], o.end ? o.end : false );
            return true;
        });
    },

    /**
     * Called from mySensors.iforkableStart()
     * @param {mySensors} instance
     */
    start( instance ){
        instance.api().exports().Msg.debug( 'mysTcp.start()' );
        // publish inclusion status
        mysMqtt.publish( instance, 'inclusion/status', mysTcp.inclusionStatus( instance ));
        mysMqtt.publish( instance, 'inclusion/conf', mysTcp.inclusionConfig( instance ));
    }
};
