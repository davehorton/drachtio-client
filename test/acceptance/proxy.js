var assert = require('assert');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var should = require('should');
var config = require('./fixtures/localConfig');
var fs = require('fs') ;
var merge = require('merge') ;
var debug = require('debug')('drachtio-client') ;
var localAgent;
var remoteAgent;
var remoteAgent2;

var noop = function(req,res){} ;
var cfg = {} ;

describe('proxy', function() {
    this.timeout(6000) ;

    before(function(done){
        cfg = require('./fixtures/remoteConfig') ;
        var mockedConfig = merge( {
            proxyTarget: cfg.remote_uri2,
            proxyType: 'stateful'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {
            localAgent = require('../..').Agent(noop) ;
            localAgent.set('api logger',fs.createWriteStream(config.apiLog) ) ;
            localAgent.connect(config.connect_opts, function(err){
                done() ;
            });        
        }) ;
    }) ;
    after(function(done){
        localAgent.disconnect() ;
        remoteAgent.disconnect() ;
        if( remoteAgent2 ) remoteAgent2.disconnect() ;
        done() ;
    }) ;
 
    it('should respond 483 Too Many Hops when Max-Forwards is 0', function(done) {
        localAgent.request({
            uri: config.request_uri,
            method: 'INVITE',
            headers: {
                'Max-Forwards': 0
            },
            body: config.sdp
        }, function( err, req ) {
            should.not.exist(err) ;
            req.on('response', function(res){
                res.should.have.property('status',483); 
                //localAgent.idle.should.be.true ;
                //remoteAgent.idle.should.be.true ;
                done() ;
            }) ;
        }) ;
    }) ;

    it('should decrement Max-Forwards when provided', function(done) {
        remoteAgent.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: cfg.remote_uri2,
            proxyType: 'stateless'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = require('./fixtures/remoteConfig2') ;
            remoteAgent2 = require('../../examples/invite-success-uas-bye/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                //
                //install a handler for the BYE request
                //
                localAgent.set('handler', function( req, res){
                    req.method.should.eql('BYE') ;
                    res.send(200, function(err, bye){
                        should.not.exist(err) ;
                        localAgent.idle.should.be.true; 
                        setTimeout(function(){
                            remoteAgent.idle.should.be.true; 
                            done() ;
                        }, 50) ;
                    }) ;
                }) ;

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    headers: {
                        'Max-Forwards': 11
                    },
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        res.should.have.property('status',200); 
                        res.get('Max-Forwards').should.eql('10') ;
                        ack() ;
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;    


    it('should add Record-Route header when stateful', function(done) {
        remoteAgent.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: cfg.remote_uri2,
            proxyType: 'stateful'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = require('./fixtures/remoteConfig2') ;
            remoteAgent2 = require('../../examples/invite-success-uas-bye/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                //
                //install a handler for the BYE request
                //
                localAgent.set('handler', function( req, res){
                    req.method.should.eql('BYE') ;
                    res.send(200, function(err, bye){
                        should.not.exist(err) ;
                        localAgent.idle.should.be.true; 
                        setTimeout(function(){
                            remoteAgent.idle.should.be.true; 
                            done() ;
                        }, 50) ;
                    }) ;
                }) ;

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    headers: {
                        'Max-Forwards': 70
                    },
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        res.should.have.property('status',200); 
                        var route = res.get('Record-Route') ;
                        route.should.exist ;
                        ack() ;
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;

    it('should not add Record-Route header when stateless', function(done) {
        remoteAgent.disconnect() ;
        remoteAgent2.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: cfg.remote_uri2,
            proxyType: 'stateless'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = require('./fixtures/remoteConfig2') ;
            remoteAgent2 = require('../../examples/invite-success-uas-bye/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                //
                //install a handler for the BYE request
                //
                localAgent.set('handler', function( req, res){
                    req.method.should.eql('BYE') ;
                    res.send(200, function(err, bye){
                        should.not.exist(err) ;
                        localAgent.idle.should.be.true; 
                        setTimeout(function(){
                            remoteAgent.idle.should.be.true; 
                            done() ;
                        }, 50) ;
                    }) ;
                }) ;

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    headers: {
                        'Max-Forwards': 70
                    },
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        res.should.have.property('status',200); 
                        should.not.exist(res.get('Record-Route')) ;
                        ack() ;
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;    
    it('should handle PRACK during call setup when 100rel required', function(done) {
        remoteAgent.disconnect() ;
        remoteAgent2.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: cfg.remote_uri2,
            proxyType: 'stateful'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = require('./fixtures/remoteConfig2') ;
            remoteAgent2 = require('../../examples/invite-100rel/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    headers: {
                        'Require': '100rel'
                    },
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        if( res.status > 100 && res.status < 200 ) {
                            var require = res.get('Require') ;
                            require.should.eql('100rel') ;
                            ack() ;
                        }
                        if( res.status >= 200 ) {
                            res.should.have.property('status',200); 
                            ack() ; 
                           //
                            //after a short time, send a BYE and validate the response
                            //
                            setTimeout( function(){
                                localAgent.request({
                                    method: 'BYE',
                                    stackDialogId: res.stackDialogId
                                }, function(err, bye){
                                    should.not.exist(err) ;
                                    bye.on('response', function(response){
                                        response.should.have.property('status',200);
                                        localAgent.idle.should.be.true ;
                                        remoteAgent.idle.should.be.true ;
                                        done() ;
                                    }) ;
                                }) ;
                            }, 1) ;
                        }
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;    
    it('should not follow redirect responses by default', function(done) {
        remoteAgent.disconnect() ;
        remoteAgent2.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: cfg.remote_uri2,
            proxyType: 'stateless'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = merge({contact: 'sip:1234@127.0.0.1:5062'}, require('./fixtures/remoteConfig2')) ;
            remoteAgent2 = require('../../examples/invite-redirect-uas/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        res.should.have.property('status',302); 
                        ack() ;
                        done() ;
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;    
    it('should follow redirect responses when configured to', function(done) {
        remoteAgent.disconnect() ;
        remoteAgent2.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: cfg.remote_uri2,
            proxyType: 'stateless',
            followRedirects: true
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = merge({contact: '<sip:1234@127.0.0.1:5062;dtg=TG_A>'}, require('./fixtures/remoteConfig2')) ;
            remoteAgent2 = require('../../examples/invite-redirect-uas/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                //
                //install a handler for the BYE request
                //
                localAgent.set('handler', function( req, res){
                    req.method.should.eql('BYE') ;
                    res.send(200, function(err, bye){
                        should.not.exist(err) ;
                        localAgent.idle.should.be.true; 
                        setTimeout(function(){
                            remoteAgent.idle.should.be.true; 
                            done() ;
                        }, 50) ;
                    }) ;
                }) ;

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        if( res.status >= 200 ) {
                            res.should.have.property('status',200); 
                            ack() ;
                        }
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;    
    it('should support a provisional timeout in seconds', function(done) {
        remoteAgent.disconnect() ;
        remoteAgent2.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: ['sip:nobody@127.0.0.1:6060',cfg.remote_uri2],
            proxyType: 'stateless',
            provisionalTimeout: '1s'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = require('./fixtures/remoteConfig2') ;
            remoteAgent2 = require('../../examples/invite-success-uas-bye/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                //
                //install a handler for the BYE request
                //
                localAgent.set('handler', function( req, res){
                    req.method.should.eql('BYE') ;
                    res.send(200, function(err, bye){
                        should.not.exist(err) ;
                        localAgent.idle.should.be.true; 
                        setTimeout(function(){
                            remoteAgent.idle.should.be.true; 
                            done() ;
                        }, 50) ;
                    }) ;
                }) ;

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        res.should.have.property('status',200); 
                        ack() ;
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;    
    it('should support a provisional timeout in milliseconds', function(done) {
        remoteAgent.disconnect() ;
        remoteAgent2.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: ['sip:nobody@127.0.0.1:6060',cfg.remote_uri2],
            proxyType: 'stateful',
            provisionalTimeout: '800ms'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = require('./fixtures/remoteConfig2') ;
            remoteAgent2 = require('../../examples/invite-success-uas-bye/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                //
                //install a handler for the BYE request
                //
                localAgent.set('handler', function( req, res){
                    req.method.should.eql('BYE') ;
                    res.send(200, function(err, bye){
                        should.not.exist(err) ;
                        localAgent.idle.should.be.true; 
                        setTimeout(function(){
                            remoteAgent.idle.should.be.true; 
                            done() ;
                        }, 50) ;
                    }) ;
                }) ;

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        res.should.have.property('status',200); 
                        ack() ;
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;    
    it('should support a final timeout in seconds', function(done) {
        remoteAgent.disconnect() ;
        remoteAgent2.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: [cfg.remote_uri2,cfg.remote_uri2],
            proxyType: 'stateful',
            provisionalTimeout: '1500ms',
            finalTimeout: '2s'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = merge( {allowCancel: 1}, require('./fixtures/remoteConfig2') );
            remoteAgent2 = require('../../examples/invite-success-uas-bye/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                //
                //install a handler for the BYE request
                //
                localAgent.set('handler', function( req, res){
                    req.method.should.eql('BYE') ;
                    res.send(200, function(err, bye){
                        should.not.exist(err) ;
                        localAgent.idle.should.be.true; 
                        setTimeout(function(){
                            remoteAgent.idle.should.be.true; 
                            done() ;
                        }, 50) ;
                    }) ;
                }) ;

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        if( res.status >= 200 ) {
                            res.should.have.property('status',200); 
                            ack() ;                            
                        }
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;    
    it('should cancel multiple invites if necessary', function(done) {
        remoteAgent.disconnect() ;
        remoteAgent2.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: [cfg.remote_uri2,cfg.remote_uri2,cfg.remote_uri2],
            proxyType: 'stateful',
            finalTimeout: '1s'
        }, cfg) ;
        remoteAgent = require('../../examples/proxy/app')(mockedConfig) ;
        remoteAgent.on('connect', function() {

            var mockedConfig = merge( {allowCancel: 2}, require('./fixtures/remoteConfig2') );
            remoteAgent2 = require('../../examples/invite-success-uas-bye/app')(mockedConfig) ;
            remoteAgent2.on('connect', function() {

                //
                //install a handler for the BYE request
                //
                localAgent.set('handler', function( req, res){
                    req.method.should.eql('BYE') ;
                    res.send(200, function(err, bye){
                        should.not.exist(err) ;
                        localAgent.idle.should.be.true; 
                        setTimeout(function(){
                            remoteAgent.idle.should.be.true; 
                            done() ;
                        }, 50) ;
                    }) ;
                }) ;

                localAgent.request({
                    uri: config.request_uri,
                    method: 'INVITE',
                    body: config.sdp
                }, function( err, req ) {
                    should.not.exist(err) ;
                    req.on('response', function(res, ack){
                        if( res.status >= 200 ) {
                            res.should.have.property('status',200); 
                            ack() ;                            
                        }
                    }) ;
                }) ;            
            }) ;
        }) ;
    }) ;    

}) ;
