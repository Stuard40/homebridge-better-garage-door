# homebridge-weather-cloud-inside-temperature-sensor Plugin

This [Homebridge](https://github.com/nfarina/homebridge) plugin can be used integrate your Weather Cloud Inside temperature into HomeKit.

## Installation

First of all you need to have [Homebridge](https://github.com/nfarina/homebridge) installed. Refer to the repo for 
instructions.  
Then run the following command to install `homebridge-weather-cloud-inside-temperature-sensor`

```
sudo npm install -g homebridge-weather-cloud-inside-temperature-sensor
```

## Configuration

The configuration can contain the following properties:

##### Basic configuration options:

* `name` \<string\> **required**: Defines the name which is later displayed in HomeKit
* `login` \<string\> **required**: Your login into Weather Cloud.
* `password` \<string\> **required**: Your password into Weather Cloud
* `deviceCode` \<string\> **required**: https://app.weathercloud.net/d${Device Code}
* `statusCache` \<number\> **required**: Status cache timeout in milliseconds, Weather Cloud API accept new data each 10 minutes for free users and 1 minute for Pro and Premium users. Recommended value is 7 minutes (420000ms)
* `pullInterval` \<number\> **required**: Number of millis between attempts for load new data from Weather Cloud. Recommended value is 7 minutes (420000ms)
