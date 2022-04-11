/*
 * manages request to the REST API
 */
import axios from 'axios';
import https from 'https';

export const rest = {

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
        let _options = {
            method: method,
            url: _baseUrl+url,
            httpsAgent: new https.Agent( instance.getCerts())
        };
        return axios( _options )
            .then(( res ) => {
                exports.Msg.verbose( 'mySensors.rest.request() res='+res.status+' '+res.statusText+' ,payload=', res.data );
                return Promise.resolve( res.data );
            }).catch(( err ) => {
                exports.Msg.error( 'mySensors.rest.request() error', err );
                return Promise.resolve( null );
            });
    }
};
