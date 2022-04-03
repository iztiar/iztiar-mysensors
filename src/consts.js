/*
 * consts.js
 * See https://www.mysensors.org/download/serial_api_20
 * 
 * Iztiar note:
 * 
 *  The MySensors protocol plans communications between sensors, between sensor and the gateway, and between gateway and controller.
 *  Iztiar considers that:
 *  - communication between MySensors sensors is out of its perimeter
 *  - communication between MySensors gateway and Iztiar controller cannot ben handled by MySensors protocol, but must be protocol agnostic
 *      (managed here by the ITcpSerger)
 */

//let mysConsts = {};

/*
 * Commands
 */
/*
export const C_PRESENTATION             = 'C_PRESENTATION';
export const C_SET                      = 'C_SET';
export const C_REQ                      = 'C_REQ';
export const C_INTERNAL                 = 'C_INTERNAL';
export const C_STREAM                   = 'C_STREAM';

mysConsts.C = {
    '0':
    C_PRESENTATION: {
        id: '0',
        label: 'Sent by a node when they present attached sensors. This is usually done in the presentation() function which runs at startup.'
    }
    C_SET:          '1', // This message is sent from or to a sensor when a sensor value should be updated
    C_REQ:          '2', // Requests a variable value (usually from an actuator destined for controller).
    C_INTERNAL:     '3', // This is a special internal message. See table below for the details
    C_STREAM:       '4'  // Used for OTA firmware updates
};

C_PRESENTATION: '0', // Sent by a node when they present attached sensors. This is usually done in the ** presentation()** function which runs at startup.
C_SET:          '1', // This message is sent from or to a sensor when a sensor value should be updated
C_REQ:          '2', // Requests a variable value (usually from an actuator destined for controller).
C_INTERNAL:     '3', // This is a special internal message. See table below for the details
C_STREAM:       '4'  // Used for OTA firmware updates
*/

// sensor type
/*
export const S_DOOR                     = 'S_DOOR';
export const S_MOTION                   = 'S_MOTION';
export const S_SMOKE                    = 'S_SMOKE';
export const S_BINARY                   = 'S_BINARY';
export const S_DIMMER                   = 'S_DIMMER';
export const S_COVER                    = 'S_COVER';
export const S_TEMP                     = 'S_TEMP';
export const S_HUM                      = 'S_HUM';
export const S_BARO                     = 'S_BARO';
export const S_WIND                     = 'S_WIND';
export const S_RAIN                     = 'S_RAIN';
export const S_UV                       = 'S_UV';
export const S_WEIGHT                   = 'S_WEIGHT';
export const S_POWER                    = 'S_POWER';
export const S_HEATER                   = 'S_HEATER';
export const S_DISTANCE                 = 'S_DISTANCE';
export const S_LIGHT_LEVEL              = 'S_LIGHT_LEVEL';
export const S_ARDUINO_NODE             = 'S_ARDUINO_NODE';
export const S_ARDUINO_REPEATER_NODE    = 'S_ARDUINO_REPEATER_NODE';
export const S_LOCK                     = 'S_LOCK';
export const S_IR                       = 'S_IR';
export const S_WATER                    = 'S_WATER';
export const S_AIR_QUALITY              = 'S_AIR_QUALITY';
export const S_CUSTOM                   = 'S_CUSTOM';
export const S_DUST                     = 'S_DUST';
export const S_SCENE_CONTROLLER         = 'S_SCENE_CONTROLLER';
export const S_RGB_LIGHT                = 'S_RGB_LIGHT';
export const S_RGBW_LIGHT               = 'S_RGBW_LIGHT';
export const S_COLOR_SENSOR             = 'S_COLOR_SENSOR';
export const S_HVAC                     = 'S_HVAC';
export const S_MULTIMETER               = 'S_MULTIMETER';
export const S_SPRINKLER                = 'S_SPRINKLER';
export const S_WATER_LEAK               = 'S_WATER_LEAK';
export const S_SOUND                    = 'S_SOUND';
export const S_VIBRATION                = 'S_VIBRATION';
export const S_MOISTURE                 = 'S_MOISTURE';
export const S_INFO                     = 'S_INFO';
export const S_GAS                      = 'S_GAS';
export const S_GPS                      = 'S_GPS';
export const S_WATER_QUALITY            = 'S_WATER_QUALITY';
*/

// data type
/*
export const V_TEMP                     = 'V_TEMP';
export const V_HUM                      = 'V_HUM';
export const V_STATUS                   = 'V_STATUS';
export const V_PERCENTAGE               = 'V_PERCENTAGE';
export const V_PRESSURE                 = 'V_PRESSURE';
export const V_FORECAST                 = 'V_FORECAST';
export const V_RAIN                     = 'V_RAIN';
export const V_RAINRATE                 = 'V_RAINRATE';
export const V_WIND                     = 'V_WIND';
export const V_GUST                     = 'V_GUST';
export const V_DIRECTION                = 'V_DIRECTION';
export const V_UV                       = 'V_UV';
export const V_WEIGHT                   = 'V_WEIGHT';
export const V_DISTANCE                 = 'V_DISTANCE';
export const V_IMPEDANCE                = 'V_IMPEDANCE';
export const V_ARMED                    = 'V_ARMED';
export const V_TRIPPED                  = 'V_TRIPPED';
export const V_WATT                     = 'V_WATT';
export const V_KWH                      = 'V_KWH';
export const V_SCENE_ON                 = 'V_SCENE_ON';
export const V_SCENE_OFF                = 'V_SCENE_OFF';
export const V_HVAC_FLOW_STATE          = 'V_HVAC_FLOW_STATE';
export const V_HVAC_SPEED               = 'V_HVAC_SPEED';
export const V_LIGHT_LEVEL              = 'V_LIGHT_LEVEL';
export const V_VAR1                     = 'V_VAR1';
export const V_VAR2                     = 'V_VAR2';
export const V_VAR3                     = 'V_VAR3';
export const V_VAR4                     = 'V_VAR4';
export const V_VAR5                     = 'V_VAR5';
export const V_UP                       = 'V_UP';
export const V_DOWN                     = 'V_DOWN';
export const V_STOP                     = 'V_STOP';
export const V_IR_SEND                  = 'V_IR_SEND';
export const V_IR_RECEIVE               = 'V_IR_RECEIVE';
export const V_FLOW                     = 'V_FLOW';
export const V_VOLUME                   = 'V_VOLUME';
export const V_LOCK_STATUS              = 'V_LOCK_STATUS';
export const V_LEVEL                    = 'V_LEVEL';
export const V_VOLTAGE                  = 'V_VOLTAGE';
export const V_CURRENT                  = 'V_CURRENT';
export const V_RGB                      = 'V_RGB';
export const V_RGBW                     = 'V_RGBW';
export const V_ID                       = 'V_ID';
export const V_UNIT_PREFIX              = 'V_UNIT_PREFIX';
export const V_HVAC_SETPOINT_COOL       = 'V_HVAC_SETPOINT_COOL';
export const V_HVAC_SETPOINT_HEAT       = 'V_HVAC_SETPOINT_HEAT';
export const V_HVAC_FLOW_MODE           = 'V_HVAC_FLOW_MODE';
export const V_TEXT                     = 'V_TEXT';
export const V_CUSTOM                   = 'V_CUSTOM';
export const V_POSITION                 = 'V_POSITION';
export const V_IR_RECORD                = 'V_IR_RECORD';
export const V_PH                       = 'V_PH';
export const V_ORP                      = 'V_ORP';
export const V_EC                       = 'V_EC';
export const V_VAR                      = 'V_VAR';
export const V_VA                       = 'V_VA';
export const V_POWER_FACTOR             = 'V_POWER_FACTOR';
*/

/*
export const I_BATTERY_LEVEL            = 'I_BATTERY_LEVEL';
export const I_TIME                     = 'I_TIME';
export const I_VERSION                  = 'I_VERSION';
export const I_ID_REQUEST               = 'I_ID_REQUEST';
export const I_ID_RESPONSE              = 'I_ID_RESPONSE';
export const I_INCLUSION_MODE           = 'I_INCLUSION_MODE';
export const I_CONFIG                   = 'I_CONFIG';
export const I_FIND_PARENT              = 'I_FIND_PARENT';
export const I_FIND_PARENT_RESPONSE     = 'I_FIND_PARENT_RESPONSE';
export const I_LOG_MESSAGE              = 'I_LOG_MESSAGE';
export const I_CHILDREN                 = 'I_CHILDREN';
export const I_SKETCH_NAME              = 'I_SKETCH_NAME';
export const I_SKETCH_VERSION           = 'I_SKETCH_VERSION';
export const I_REBOOT                   = 'I_REBOOT';
export const I_GATEWAY_READY            = 'I_GATEWAY_READY';
export const I_SIGNING_PRESENTATION     = 'I_SIGNING_PRESENTATION';
export const I_NONCE_REQUEST            = 'I_NONCE_REQUEST';
export const I_NONCE_RESPONSE           = 'I_NONCE_RESPONSE';
export const I_HEARTBEAT_REQUEST        = 'I_HEARTBEAT_REQUEST';
export const I_PRESENTATION             = 'I_PRESENTATION';
export const I_DISCOVER_REQUEST         = 'I_DISCOVER_REQUEST';
export const I_DISCOVER_RESPONSE        = 'I_DISCOVER_RESPONSE';
export const I_HEARTBEAT_RESPONSE       = 'I_HEARTBEAT_RESPONSE';
export const I_LOCKED                   = 'I_LOCKED';
export const I_PING                     = 'I_PING';
export const I_PONG                     = 'I_PONG';
export const I_REGISTRATION_REQUEST     = 'I_REGISTRATION_REQUEST';
export const I_REGISTRATION_RESPONSE    = 'I_REGISTRATION_RESPONSE';
export const I_DEBUG                    = 'I_DEBUG';
export const I_SIGNAL_REPORT_REQUEST    = 'I_SIGNAL_REPORT_REQUEST';
export const I_SIGNAL_REPORT_REVERSE    = 'I_SIGNAL_REPORT_REVERSE';
export const I_SIGNAL_REPORT_RESPONSE   = 'I_SIGNAL_REPORT_RESPONSE';
export const I_PRE_SLEEP_NOTIFICATION   = 'I_PRE_SLEEP_NOTIFICATION';
export const I_POST_SLEEP_NOTIFICATION  = 'I_POST_SLEEP_NOTIFICATION';
*/

export const mysConsts = {
    /*
     * Commands
     */
    C: {
        C_PRESENTATION: '0', // Sent by a node when they present attached sensors. This is usually done in the ** presentation()** function which runs at startup.
        C_SET:          '1', // This message is sent from or to a sensor when a sensor value should be updated
        C_REQ:          '2', // Requests a variable value (usually from an actuator destined for controller).
        C_INTERNAL:     '3', // This is a special internal message. See table below for the details
        C_STREAM:       '4'  // Used for OTA firmware updates
    },
    /*
     * Type of the sensor
     * When a presentation message is sent from a sensor, type can be one the following:
     * The payload of presentation message will be set to the library version (node device) or an optional description for the sensors.
     */
    S: {
        S_DOOR:                   '0', // Door and window sensors
        S_MOTION:                 '1', // Motion sensors
        S_SMOKE:                  '2', // Smoke sensor
        S_BINARY:                 '3', // Binary device (on/off)
        S_DIMMER:                 '4', // Dimmable device of some kind
        S_COVER:                  '5', // Window covers or shades
        S_TEMP:                   '6', // Temperature sensor
        S_HUM:                    '7', // Humidity sensor
        S_BARO:                   '8', // Barometer sensor (Pressure)
        S_WIND:                   '9', // Wind sensor
        S_RAIN:                  '10', // Rain sensor
        S_UV:                    '11', // UV sensor
        S_WEIGHT:                '12', // Weight sensor for scales etc.
        S_POWER:                 '13', // Power measuring device, like power meters
        S_HEATER:                '14', // Heater device
        S_DISTANCE:              '15', // Distance sensor
        S_LIGHT_LEVEL:           '16', // Light sensor
        S_ARDUINO_NODE:          '17', // Arduino node device	
        S_ARDUINO_REPEATER_NODE: '18', // Arduino repeating node device	
        S_LOCK:                  '19', // Lock device
        S_IR:                    '20', // Ir sender/receiver device
        S_WATER:                 '21', // Water meter
        S_AIR_QUALITY:           '22', // Air quality sensor e.g. MQ-2
        S_CUSTOM:                '23', // Use this for custom sensors where no other fits.	
        S_DUST:                  '24', // Dust level sensor
        S_SCENE_CONTROLLER:      '25', // Scene controller device
        S_RGB_LIGHT:             '26', // RGB light
        S_RGBW_LIGHT:            '27', // RGBW light (with separate white component)
        S_COLOR_SENSOR:          '28', // Color sensor
        S_HVAC:                  '29', // Thermostat/HVAC device
        S_MULTIMETER:            '30', // Multimeter device
        S_SPRINKLER:             '31', // Sprinkler device
        S_WATER_LEAK:            '32', // Water leak sensor
        S_SOUND:                 '33', // Sound sensor
        S_VIBRATION:             '34', // Vibration sensor
        S_MOISTURE:              '35', // Moisture sensor
        S_INFO:                  '36', // LCD text device
        S_GAS:                   '37', // Gas meter
        S_GPS:                   '38', // GPS Sensor
        S_WATER_QUALITY:         '39'  // Water quality sensor
    },
    /*
     * C_SET / C_REQ
     * When a set or request message is being sent, the type has to be one of the following:
     */
    V: {
        V_TEMP:                   '0', // Temperature	S_TEMP, S_HEATER, S_HVAC, S_WATER_QUALITY
        V_HUM:                    '1', // Humidity	S_HUM
        V_STATUS:                 '2', // Binary status. 0=off 1=on	S_BINARY, S_DIMMER, S_SPRINKLER, S_HVAC, S_HEATER, S_WATER_QUALITY
        V_PERCENTAGE:             '3', // Percentage value. 0-100 (%)	S_DIMMER, S_COVER
        V_PRESSURE:               '4', // Atmospheric Pressure	S_BARO
        V_FORECAST:               '5', // Whether forecast. One of "stable", "sunny", "cloudy", "unstable", "thunderstorm" or "unknown"	S_BARO
        V_RAIN:                   '6', // Amount of rain	S_RAIN
        V_RAINRATE:               '7', // Rate of rain	S_RAIN
        V_WIND:                   '8', // Windspeed	S_WIND
        V_GUST:                   '9', // Gust	S_WIND
        V_DIRECTION:             '10', // Wind direction 0-360 (degrees)	S_WIND
        V_UV:                    '11', // UV light level	S_UV
        V_WEIGHT:                '12', // Weight (for scales etc)	S_WEIGHT
        V_DISTANCE:              '13', // Distance	S_DISTANCE
        V_IMPEDANCE:             '14', // Impedance value	S_MULTIMETER, S_WEIGHT
        V_ARMED:                 '15', // Armed status of a security sensor. 1=Armed, 0=Bypassed	S_DOOR, S_MOTION, S_SMOKE, S_SPRINKLER, S_WATER_LEAK, S_SOUND, S_VIBRATION, S_MOISTURE
        V_TRIPPED:               '16', // Tripped status of a security sensor. 1=Tripped, 0=Untripped	S_DOOR, S_MOTION, S_SMOKE, S_SPRINKLER, S_WATER_LEAK, S_SOUND, S_VIBRATION, S_MOISTURE
        V_WATT:                  '17', // Watt value for power meters	S_POWER, S_BINARY, S_DIMMER, S_RGB_LIGHT, S_RGBW_LIGHT
        V_KWH:                   '18', // Accumulated number of KWH for a power meter	S_POWER
        V_SCENE_ON:              '19', // Turn on a scene	S_SCENE_CONTROLLER
        V_SCENE_OFF:             '20', // Turn of a scene	S_SCENE_CONTROLLER
        V_HVAC_FLOW_STATE:       '21', // Mode of header. One of "Off", "HeatOn", "CoolOn", or "AutoChangeOver"	S_HVAC, S_HEATER
        V_HVAC_SPEED:            '22', // HVAC/Heater fan speed ("Min", "Normal", "Max", "Auto")	S_HVAC, S_HEATER
        V_LIGHT_LEVEL:           '23', // Uncalibrated light level. 0-100%. Use V_LEVEL for light level in lux.	S_LIGHT_LEVEL
        V_VAR1:                  '24', // Custom value	Any device
        V_VAR2:                  '25', // Custom value	Any device
        V_VAR3:                  '26', // Custom value	Any device
        V_VAR4:                  '27', // Custom value	Any device
        V_VAR5:                  '28', // Custom value	Any device
        V_UP:                    '29', // Window covering. Up.	S_COVER
        V_DOWN:                  '30', // Window covering. Down.	S_COVER
        V_STOP:                  '31', // Window covering. Stop.	S_COVER
        V_IR_SEND:               '32', // Send out an IR-command	S_IR
        V_IR_RECEIVE:            '33', // This message contains a received IR-command	S_IR
        V_FLOW:                  '34', // Flow of water/gas (in meter)	S_WATER, S_GAS
        V_VOLUME:                '35', // Water/gas volume	S_WATER, S_GAS
        V_LOCK_STATUS:           '36', // Set or get lock status. 1=Locked, 0=Unlocked	S_LOCK
        V_LEVEL:                 '37', // Used for sending level-value	S_DUST, S_AIR_QUALITY, S_SOUND (dB), S_VIBRATION (hz), S_LIGHT_LEVEL (lux)
        V_VOLTAGE:               '38', // Voltage level	S_MULTIMETER
        V_CURRENT:               '39', // Current level	S_MULTIMETER
        V_RGB:                   '40', // RGB value transmitted as ASCII hex string (I.e "ff0000" for red)	S_RGB_LIGHT, S_COLOR_SENSOR
        V_RGBW:                  '41', // RGBW value transmitted as ASCII hex string (I.e "ff0000ff" for red + full white)	S_RGBW_LIGHT
        V_ID:                    '42', // Optional unique sensor id (e.g. OneWire DS1820b ids)	S_TEMP
        V_UNIT_PREFIX:           '43', // Allows sensors to send in a string representing the unit prefix to be displayed in GUI. This is not parsed by controller! E.g. cm, m, km, inch.	S_DISTANCE, S_DUST, S_AIR_QUALITY
        V_HVAC_SETPOINT_COOL:    '44', // HVAC cold setpoint	S_HVAC
        V_HVAC_SETPOINT_HEAT:    '45', // HVAC/Heater setpoint	S_HVAC, S_HEATER
        V_HVAC_FLOW_MODE:        '46', // Flow mode for HVAC ("Auto", "ContinuousOn", "PeriodicOn")	S_HVAC
        V_TEXT:                  '47', // Text message to display on LCD or controller device	S_INFO
        V_CUSTOM:                '48', // Custom messages used for controller/inter node specific commands, preferably using S_CUSTOM device type.	S_CUSTOM
        V_POSITION:              '49', // GPS position and altitude. Payload: latitude;longitude;altitude(m). E.g. "55.722526;13.017972;18"	S_GPS
        V_IR_RECORD:             '50', // Record IR codes S_IR for playback	S_IR
        V_PH:                    '51', // Water PH	S_WATER_QUALITY
        V_ORP:                   '52', // Water ORP : redox potential in mV	S_WATER_QUALITY
        V_EC:                    '53', // Water electric conductivity μS/cm (microSiemens/cm)	S_WATER_QUALITY
        V_VAR:                   '54', // Reactive power: volt-ampere reactive (var)	S_POWER
        V_VA:                    '55', // Apparent power: volt-ampere (VA)	S_POWER
        V_POWER_FACTOR:          '56'  // Ratio of real power to apparent power: floating point value in the range [-1,..,1]
    },
    /*
     * C_INTERNAL
     * The internal messages are used for different tasks in the communication between sensors,
     * the gateway to controller and between sensors and the gateway.
     * When an internal messages is sent, the type has to be one of the following:
     */
    I: {
        I_BATTERY_LEVEL:             '0', // Use this to report the battery level (in percent 0-100).
        I_TIME:                      '1', // Sensors can request the current time from the Controller using this message. The time will be reported as the seconds since 1970
        I_VERSION:                   '2', // Used to request gateway version from controller.
        I_ID_REQUEST:                '3', // Use this to request a unique node id from the controller.
        I_ID_RESPONSE:               '4', // Id response back to node. Payload contains node id.
        I_INCLUSION_MODE:            '5', // Start/stop inclusion mode of the Controller (1=start, 0=stop).
        I_CONFIG:                    '6', // Config request from node. Reply with (M)etric or (I)mperal back to sensor.
        I_FIND_PARENT:               '7', // When a sensor starts up, it broadcast a search request to all neighbor nodes. They reply with a I_FIND_PARENT_RESPONSE.
        I_FIND_PARENT_RESPONSE:      '8', // Reply message type to I_FIND_PARENT request.
        I_LOG_MESSAGE:               '9', // Sent by the gateway to the Controller to trace-log a message
        I_CHILDREN:                 '10', // A message that can be used to transfer child sensors (from EEPROM routing table) of a repeating node.
        I_SKETCH_NAME:              '11', // Optional sketch name that can be used to identify sensor in the Controller GUI
        I_SKETCH_VERSION:           '12', // Optional sketch version that can be reported to keep track of the version of sensor in the Controller GUI.
        I_REBOOT:                   '13', // Used by OTA firmware updates. Request for node to reboot.
        I_GATEWAY_READY:            '14', // Send by gateway to controller when startup is complete.
        I_SIGNING_PRESENTATION:     '15', // Provides signing related preferences (first byte is preference version).
        I_NONCE_REQUEST:            '16', // Used between sensors when requesting nonce.
        I_NONCE_RESPONSE:           '17', // Used between sensors for nonce response.
        I_HEARTBEAT_REQUEST:        '18', // Heartbeat request
        I_PRESENTATION:             '19', // Presentation message
        I_DISCOVER_REQUEST:         '20', // Discover request
        I_DISCOVER_RESPONSE:        '21', // Discover response
        I_HEARTBEAT_RESPONSE:       '22', // Heartbeat response
        I_LOCKED:                   '23', // Node is locked (reason in string-payload)
        I_PING:                     '24', // Ping sent to node, payload incremental hop counter
        I_PONG:                     '25', // In return to ping, sent back to sender, payload incremental hop counter
        I_REGISTRATION_REQUEST:     '26', // Register request to GW
        I_REGISTRATION_RESPONSE:    '27', // Register response from GW
        I_DEBUG:                    '28', // Debug message
        I_SIGNAL_REPORT_REQUEST:    '29', // Device signal strength request
        I_SIGNAL_REPORT_REVERSE:    '30', // Internal
        I_SIGNAL_REPORT_RESPONSE:   '31', // Device signal strength response (RSSI)
        I_PRE_SLEEP_NOTIFICATION:   '32', // Message sent before node is going to sleep
        I_POST_SLEEP_NOTIFICATION:  '33'  // Message sent after node woke up (if enabled)
    }
};
