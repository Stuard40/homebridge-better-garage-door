"use strict";

let Service, Characteristic, api;

const packageJSON = require("./package.json");
const _hapClient = require("@oznu/hap-client");
const HapClient = _hapClient.HapClient;

module.exports = function (homebridge) {

    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    api = homebridge;

    homebridge.registerAccessory(
        "homebridge-better-garage-door",
        "homebridge-better-garage-door",
        BetterGarageDoor
    );

};

function BetterGarageDoor(log, config) {

    this.log = log;
    this.name = config.name;
    this.debug = config.debug || false;

    this.log.info("Better Garage Door initialization Step I started!");

    if (config.switchServiceName) {
        this.switchServiceName = config.switchServiceName;
    } else {
        this.log.warn("Property 'switchServiceName' is required!");
        this.log.warn("Aborting...");
        return;
    }

    if (config.switchCharacteristicName) {
        this.switchCharacteristicName = config.switchCharacteristicName;
    } else {
        this.switchCharacteristicName = 'On';
    }

    if (config.sensorServiceName) {
        this.sensorServiceName = config.sensorServiceName;
    } else {
        this.log.warn("Property 'sensorServiceName' is required!");
        this.log.warn("Aborting...");
        return;
    }

    if (config.sensorCharacteristicName) {
        this.sensorCharacteristicName = config.sensorCharacteristicName;
    } else {
        this.sensorCharacteristicName = 'ContactSensorState';
    }

    if (config.openTime) {
        this.openTime = config.openTime * 1000;
    } else {
        this.log.warn("Property 'openTime' not required but it is recommended for better performance!");
    }

    if (config.hapClientPin) {
        this.hapClientPin = config.hapClientPin;
    } else {
        this.log.warn("Property 'hapClientPin' is required!");
        this.log.warn("Aborting...");
        return;
    }

    try {
        this.hapClient = new HapClient({
            pin: config.hapClientPin,
            logger: log,
            config: {},
        });
    } catch (e) {
        this.log.warn("Unable connect to HomeBridge check hapClientPin property!");
        this.log.warn("Aborting...");
        return;
    }

    this.service = new Service.GarageDoorOpener(this.name, this.name);

    this.service.getCharacteristic(Characteristic.CurrentDoorState).setValue(Characteristic.CurrentDoorState.CLOSED);
    this.service.getCharacteristic(Characteristic.TargetDoorState).setValue(Characteristic.TargetDoorState.CLOSED);

    this.log.info("Better Garage Door initialization Step I finished!");

    const initDelay = config.initDelay ? config.initDelay : 20000;

    this.log.info(`Better Garage Door initialization Step II will be started after ${initDelay} ms`);

    setTimeout(() => {
        this.init().then(() => {
        });
    }, initDelay);


}

BetterGarageDoor.prototype = {

    identify: function (callback) {
        this.log("Identify requested!");
        callback();
    },

    getServices: function () {
        if (!this.service) {
            return [];
        }

        this.informationService = new Service.AccessoryInformation();

        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, "Martin Hampl")
            .setCharacteristic(Characteristic.Model, "Simple JS Automation")
            .setCharacteristic(Characteristic.SerialNumber, "MH02")
            .setCharacteristic(Characteristic.FirmwareRevision, packageJSON.version);

        return [this.informationService, this.service];
    },

    init: async function () {
        this.log.info("Better Garage Door initialization Step II started!");

        this.switchService = await this.hapClient.getServiceByName(this.switchServiceName);

        if (!this.switchService) {
            this.log.warn("Unable find switch in HomeBridge check if switch name is correct or increase initDelay if not initialized yet!");
            this.printAllServiceNames();
            this.log.warn("Aborting...");
            return;
        }

        if (!this.switchService.getCharacteristic(this.switchCharacteristicName)) {
            this.log.warn(`Unable find sensor characteristic ${this.switchCharacteristicName}!`);
            this.searchAllServicesForCharacteristic(this.switchCharacteristicName);
            this.log.warn(this.switchService);
            this.log.warn("Aborting...");
        }

        this.sensorService = await this.hapClient.getServiceByName(this.sensorServiceName);

        if (!this.sensorService) {
            this.log.warn(`Unable find sensor in HomeBridge check if sensor name is correct or increase initDelay if not initialized yet!`);
            this.printAllServiceNames();
            this.log.warn("Aborting...");
            return;
        }

        if (!this.sensorService.getCharacteristic(this.sensorCharacteristicName)) {
            this.log.warn(`Unable find sensor characteristic ${this.sensorCharacteristicName}!`);
            this.searchAllServicesForCharacteristic(this.sensorCharacteristicName);
            this.log.warn(await this.sensorService);
            this.log.warn("Aborting...");
        }

        this.log.info('Starting monitoring of switch and sensor services ...');

        this.hapMonitor = await this.hapClient.monitorCharacteristics();
        if (!this.hapMonitor) {
            this.log.warn("Unable start hapMonitor!");
            this.log.warn("Aborting...");
            return;
        }

        this.log.info('Registering service-update event on hapMonitor ...');

        this.hapMonitor.on('service-update', services => {
            for (const service of services) {
                this.onServiceUpdate(service);
            }
        });
        this.hapMonitor.start();

        this.log.info('Checking current Garage state ...');

        const currentSensorState = this.sensorService.getCharacteristic(this.sensorCharacteristicName).value;

        this.service.getCharacteristic(Characteristic.CurrentDoorState).setValue(!currentSensorState);
        this.service.getCharacteristic(Characteristic.TargetDoorState).setValue(!currentSensorState);

        this.log.info(`Current Garage state set to ${currentSensorState ? 'open' : 'close'}`);

        this.service.getCharacteristic(Characteristic.TargetDoorState)
            .on('get', (callback) => {
                const targetDoorState = this.service.getCharacteristic(Characteristic.TargetDoorState).value;
                callback(null, targetDoorState);
            })
            .on('set', (value, callback) => {
                if (value === Characteristic.TargetDoorState.OPEN) {
                    this.log("Opening: " + this.name)
                    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
                    this.log(this.switchService);
                    this.switchService.getCharacteristic(this.switchCharacteristicName).setValue(1);/*.then(() => {
                        this.log("Switch set up!");
                    });*/
                    if (this.openTime) {
                        setTimeout(() => {
                            if (this.service.getCharacteristic(Characteristic.CurrentDoorState).value !== Characteristic.CurrentDoorState.OPEN) {
                                this.service.setCharacteristic(Characteristic.ObstructionDetected, 1);
                            } else {
                                this.service.setCharacteristic(Characteristic.ObstructionDetected, 0);
                            }
                        }, this.openTime);
                    }
                    callback();
                } else if (value === Characteristic.TargetDoorState.CLOSED) {
                    this.log("Closing: " + this.name)
                    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
                    this.switchService.getCharacteristic(this.switchCharacteristicName).setValue(1);
                    if (this.openTime) {
                        setTimeout(() => {
                            if (this.service.getCharacteristic(Characteristic.CurrentDoorState).value !== Characteristic.CurrentDoorState.CLOSED) {
                                this.service.setCharacteristic(Characteristic.ObstructionDetected, 1);
                            } else {
                                this.service.setCharacteristic(Characteristic.ObstructionDetected, 0);
                            }
                        }, this.openTime);
                    }
                    callback();
                } else {
                    callback();
                }
            });

        this.log.info("Better Garage Door initialization Step II finished!");
    },

    onServiceUpdate(service) {
        try {
            if (this.isGarageDoorSwitch(service)) {
                return;
            }
            if (this.isGarageDoorSensor(service)) {
                this.onGarageDoorSensorUpdate(service);
            }
        } catch (e) {
            this.log.error(e, service);
        }
    },

    onGarageDoorSensorUpdate(service) {
        const sensorValue = service.getCharacteristic(this.sensorCharacteristicName).value;
        const doorState = sensorValue ? Characteristic.CurrentDoorState.OPEN : Characteristic.CurrentDoorState.CLOSED
        this.service.setCharacteristic(Characteristic.CurrentDoorState, doorState);
        this.service.setCharacteristic(Characteristic.ObstructionDetected, 0);
    },

    isGarageDoorSwitch: function (service) {
        return service.serviceName === this.switchServiceName;
    },

    isGarageDoorSensor: function (service) {
        return service.serviceName === this.sensorServiceName;
    },

    searchAllServicesForCharacteristic: function (characteristicName) {
        this.hapClient.getAllServices()
            .then(services => {
                const matchingServices = services
                    .filter(service => service.getCharacteristic(characteristicName))
                    .map(service => service.serviceName);
                this.log.warn(`Services with characteristic '${characteristicName}' is ${matchingServices}`,);
            });
    },

    printAllServiceNames: function () {
        this.hapClient.getAllServices()
            .then(services => {
                const serviceNames = services.map(service => service.serviceName);
                this.log.warn(`Available Services is ${serviceNames}`,);
            });
    }

};
