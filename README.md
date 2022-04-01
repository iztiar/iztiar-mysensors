# Iztiar

## iztiar-mysensors

___iztiar-mysensors___ module provides a MySensors gateway to the Iztiar family. This gateway relies on the following classes:

    - `mysensors.class.js`: a service feature which acts as the link between MySensors devices and Iztiar

        `mysensors.class.js` provides a mySensorsClass class which embeds:

        - a device reader from USB port or MQTT bus or network host:port
        - a Iztiar reader through a ITcpServer

    - `mysensors.routes.js`: an add-on for the REST API, which lets the mySensors class interacts with Iztiar.

### Service feature

The service feature manages an external hardware gateway, which may be serial, or on the network, on managed through a MQTT message bus, or anything else (as this is only implementation and configuration tasks).

It receives messages from the devices, and transforms and forwards the result to Iztiar.

It is able to answer itself to some service messages which may be sent by the devices.

It also provides a TCP server, so that Iztiar is able to send some commands directly to the gateway without having to publish them on a message bus.

As of v0.1.0, the feature only manages a serial gateway, attached to our computer through an USB bus.

## MySensors

    [Serial API](https://www.mysensors.org/download/serial_api_20)
    [Library API](https://www.mysensors.org/download/sensor_api_20)
