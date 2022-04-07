/*
 * manages request to the REST API
 */
import axios from 'axios';

import { mysMessage } from './imports.js';

export const rest = {

    _axios_instance: null,

    _axios: function(){
        if( !rest._axios_instance ){
            rest._axios_instance = axios.create({
                baseURL: 'http://localhost:24011/v1'
            });
        }
        return rest._axios_instance;
    },

    /**
     * @param {mySensorsClass} instance
     * @param {String} command
     *  GetNextId
     * @param {mysMessage} msg
     * @return {Promise} which resolves to the next available node_id, or null
     */
    request: function( instance, command, msg ){
        const exports = instance.api().exports();
        exports.Msg.debug( 'mySensorsClass.rest.request() command='+command, msg );
        instance._counters.toController += 1;
        let _promise = Promise.resolve( null );
        return axios({
            method: 'get',
            url: 'http://localhost:24011/v1/counter/mySensors/next'
        //rest._axios().get({
        //    url: '/counter/mySensors/next'
        })
        .then(( res ) => {
            exports.Msg.verbose( 'mySensors.rest.request() res='+res.status+' '+res.statusText+' ,payload='+res.data.nextId );
            return _promise = Promise.resolve( res.data.nextId );
        }).catch(( err ) => {
            exports.Msg.error( 'mySensors.rest.request() error', err );
            return _promise;
        });
    }
};
