/*
 * main.js
 *
 *  This is the default export of the module.
 *  This is also the Iztiar initialization entry point as this default export is identified in the 'main' key of package.json
 */
import { mySensorsClass } from './imports.js';

/**
 * @param {engineApi} api the engine API as described in engine-api.schema.json
 * @param {featureCard} card a description of this feature
 * @returns {Promise} which must resolves to an featureProvider instance
 */
export default ( api, card ) => {
    //console.log( '@iztiar/iztiar-mysensors default exported function()' );
    //console.log( api );
    return new mySensorsClass( api, card );
}
