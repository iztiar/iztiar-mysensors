/*
 * manages request to the REST API
 */
import axios from 'axios';
import https from 'https';

import { mysMessage } from './imports.js';

export const rest = {

    _axios_instance: null,

    _axios: function( instance ){
        if( !rest._axios_instance ){
            rest._axios_instance = axios.create({
                httpsAgent: new https.Agent({})
            });
        }
        return rest._axios_instance;
    },

    /**
     * @param {mySensors} instance
     * @param {String} url
     * @param {mysMessage} msg
     * @return {Promise} which resolves to the next available node_id, or null
     */
    request0: function( instance, url, msg ){
        const exports = instance.api().exports();
        exports.Msg.debug( 'mySensors.rest.request() command='+command, msg );
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
    },

    /**
     * @param {mySensors} instance
     * @param {String} method
     * @param {String} url
     * @param {Object} data
     * @return {Promise} which resolves to the answered object
     */
    request: function( instance, method, url, data=null ){
        const exports = instance.api().exports();
        exports.Msg.debug( 'mySensors.rest.request() ', method, url, data );
        instance._counters.toController += 1;
        let _baseUrl = instance.feature().config().REST.baseUrl;
        let _promise = Promise.resolve( null );
        let _options = {
            method: method,
            url: _baseUrl+url,
            httpsAgent: new https.Agent( instance.getCerts())
        };
        return axios( _options )
            .then(( res ) => {
                exports.Msg.verbose( 'mySensors.rest.request() res='+res.status+' '+res.statusText+' ,payload=', res.data );
                return _promise = Promise.resolve( res.data );
            }).catch(( err ) => {
                exports.Msg.error( 'mySensors.rest.request() error', err );
                return _promise;
            });
    }
};
