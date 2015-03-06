# dracht.io [![Build Status](https://secure.travis-ci.org/davehorton/drachtio-client.png)](http://travis-ci.org/davehorton/drachtio-client) [![NPM version](https://badge.fury.io/js/drachtio-client.svg)](http://badge.fury.io/js/drachtio-client)

[![drachtio logo](http://www.dracht.io/images/definition_only-cropped.png)](http://dracht.io/)

dracht.io is an application framework that is designed to let node.js developers easily integrate Voice-over-IP (VoIP) features into their applications using familiar middleware patterns. 

The dracht.io architecture consists of the following components:

+ [drachtio-server](https://github.com/davehorton/drachtio-server) - A high-performance, resilient SIP user agent that can be controlled by one or more client applications over a TCP network connection.  The drachtio-server is written in C++ and is based on the open source sofia sip stack that is used in [Freeswitch](http://freeswitch.org)
+ [drachtio-client](https://github.com/davehorton/drachtio-client) - Low-level javascript library that provides abstraction for SIP request and response processing.
+ [drachtio-connect](https://github.com/davehorton/drachtio-connect) - Higher-level framework designed to offer familiar middleware patterns to web application developers, enabling them to easily incorporate VoIP features into their applications. 

## drachtio-client
drachtio-client is a low-level framework that is intended to be used in conjunction with drachtio-connect middleware.  This document describes the drachtio-client feature set and API, but the reader is encouraged to review the drachtio-connect library as well.  Generally speaking, a developer will interact with the dracht.io framework through the higher-level drachtio-connect middleware framework rather than directly through drachtio-client, although it is important to know how to create a client and to be familiar with the basic API and objects provided by this library.

dracht.io lets you build all sorts of SIP applications: SIP proxies, user agent clients and servers, back-to-back user agents, registrars, and more.  

Here is an example showing how to create a simple SIP proxy server:
```js
//require the drachtio client-side agent, and create an instance of it
var Agent = require('drachtio-client').Agent ;
var agent = new Agent(handler) ;


//connect to a drachtio server
agent.connect({
  host: 'localhost',
  port: 9022,
  secret: 'cymru'
}) ;

//tell agent which messages we want to receive
agent.route('invite') ;
agent.route('bye') ;


//now handle incoming messages
function handler(req,res) {

  if( req.msg.method === 'INVITE') {

      req.proxy({
        type: 'stateful',
        destination: 'sip:1234@mydomain.com',
        headers: {
          'User-Agent': 'drachtio rockx!'
        }        
      }, function(err, results){
        if( err ) return console.error( 'Error attempting to proxy: ', err ) ;
        console.log('results: ', JSON.stringify( results ) ) ;
      }) ;
  }
}
```


