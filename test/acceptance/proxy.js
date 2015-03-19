var assert = require('assert');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var should = require('should');
var merge = require('merge') ;
var config = require('./fixtures/localConfig');
var fs = require('fs') ;
var debug = require('debug')('drachtio-client') ;
var async = require('async') ;
var spawn = require('child_process').spawn ;
var exec = require('child_process').exec ;

var uacServer, proxyServer, uas1Server, uas2Server ;
var uac, proxy, uas1, uas2;
var uacConfig, proxyConfig, uas1Config, uas2Config;

uacConfig = require('./fixtures/localConfig') ;
proxyConfig = require('./fixtures/remoteConfig') ;
uas1Config = require('./fixtures/remoteConfig2') ;
uas2Config = clone(uas1Config);

uacConfig.connect_opts.port = 8030; uacConfig.sipAddress = 'sip:127.0.0.1:6060';
proxyConfig.connect_opts.port = 8031; proxyConfig.sipAddress = 'sip:127.0.0.1:6061';
uas1Config.connect_opts.port = 8032; uas1Config.sipAddress = 'sip:127.0.0.1:6062';
uas2Config.connect_opts.port = 8033; uas2Config.sipAddress = 'sip:127.0.0.1:6063';

debug('uas1Config: ', uas1Config) ;
debug('uas2Config: ', uas2Config) ;

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

function configureUac( config ) {
    uac = require('../..').Agent(function(req,res){}) ;
    uac.set('api logger',fs.createWriteStream(config.apiLog) ) ;
    uac.connect(config.connect_opts) ;
    return uac ;
}
function connectAll( agents, cb ) {
    async.each( agents, function( agent, callback ) {
        if( agent.connected ) agent.disconnect() ;
        agent.on('connect', function(err) {
            return callback(err) ;
        }) ;
    }, function(err) {
        if( err ) return cb(err) ;
        cb() ;
    }) ;
}

describe('proxy', function() {
    this.timeout(6000) ;

    before(function(done){
        exec('pkill drachtio', function () {
            uacServer = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.local.xml','-p',8030,'-c','sip:127.0.0.1:6060'],{cwd: process.cwd() + '/test/acceptance'}) ;
            proxyServer = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.remote.xml','-p',8031,'-c','sip:127.0.0.1:6061'],{cwd: process.cwd() + '/test/acceptance'}) ;
            uas1Server = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.remote2.xml','-p',8032,'-c','sip:127.0.0.1:6062'],{cwd: process.cwd() + '/test/acceptance'}) ;
            uas2Server = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.remote3.xml','-p',8033,'-c','sip:127.0.0.1:6063'],{cwd: process.cwd() + '/test/acceptance'}) ;
             done() ;
        }) ;
    }) ;
    after(function(done){
        this.timeout(1000) ;
        setTimeout( function() {
            uacServer.kill() ;
            proxyServer.kill() ;
            uas1Server.kill() ;
            uas2Server.kill() ;
            done() ;
        }, 250) ;
    }) ;
 
    it('should respond 483 Too Many Hops when Max-Forwards is 0', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: uas1Config.sipAddress,
            remainInDialog: true
        }, proxyConfig)) ;
        connectAll([uac, proxy], function(err){
            if( err ) throw err ;
            
            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                headers: {
                    'Max-Forwards': 0
                },
                body: config.sdp
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res){
                    res.should.have.property('status',483); 
                    uac.idle.should.be.true ;
                    setTimeout( function() {
                        proxy.idle.should.be.true ;
                        done() ;                        
                    }, 100);
                }) ;
            }) ;
        }) ;
    }) ;

    it('should decrement Max-Forwards when provided', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: uas1Config.sipAddress,
            remainInDialog: false
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-success-uas-bye/app')(uas1Config) ;
        connectAll([uac, proxy, uas1], function(err){
            if( err )  throw err ;
            //
            //install a handler for the BYE request
            //
            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    setTimeout(function(){
                        proxy.idle.should.be.true; 
                        done() ;
                    }, 100) ;
                }) ;
            }) ;

            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                headers: {
                    'Max-Forwards': 11
                },
                body: proxyConfig.sdp
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

    it('should add Record-Route header when remainInDialog is set to true', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: uas1Config.sipAddress,
            remainInDialog: true
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-success-uas-bye/app')(uas1Config) ;

        connectAll([uac, proxy, uas1], function(err){
            if( err ) throw err ;
            //
            //install a handler for the BYE request
            //
            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    setTimeout(function(){
                        proxy.idle.should.be.true; 
                        done() ;
                    }, 50) ;
                }) ;
            }) ;

            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                headers: {
                    'Max-Forwards': 70
                },
                body: proxyConfig.sdp
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res, ack){
                    res.should.have.property('status',200); 
                    should.exist( res.get('Record-Route') ) ;
                    ack() ;
                }) ;
            }) ;            
        }) ;
    }) ;

    it('should not add Record-Route header when remainInDialog set to false', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: uas1Config.sipAddress,
            remainInDialog: false
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-success-uas-bye/app')(uas1Config) ;
        connectAll([uac, proxy, uas1], function(err){

            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    setTimeout(function(){
                        proxy.idle.should.be.true; 
                        done() ;
                    }, 50) ;
                }) ;
            }) ;

            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                headers: {
                    'Max-Forwards': 70
                },
                body: uacConfig.sdp
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
    
    it('should not add Record-Route header by default', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: uas1Config.sipAddress
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-success-uas-bye/app')(uas1Config) ;
        connectAll([uac, proxy, uas1], function(err){
            if( err ) throw err ;
            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    setTimeout(function(){
                        proxy.idle.should.be.true; 
                        done() ;
                    }, 50) ;
                }) ;
            }) ;

            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                headers: {
                    'Max-Forwards': 70,
                    'Subject': 'should not add Record-Route header by default'
                },
                body: proxyConfig.sdp
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

    it('should handle PRACK during call setup when 100rel required', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: uas1Config.sipAddress,
            remainInDialog: true
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-100rel/app')(uas1Config) ;
        connectAll([uac, proxy, uas1], function(err){
            if( err ) throw err ;

            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                headers: {
                    'Require': '100rel',
                    'Subject': 'it should handle PRACK during call setup when 100rel required'
                },
                body: proxyConfig.sdp
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
                            uac.request({
                                method: 'BYE',
                                stackDialogId: res.stackDialogId
                            }, function(err, bye){
                                should.not.exist(err) ;
                                bye.on('response', function(response){
                                    response.should.have.property('status',200);
                                    uac.idle.should.be.true ;
                                    proxy.idle.should.be.true ;
                                    done() ;
                                }) ;
                            }) ;
                        }, 1) ;
                    }
                }) ;
            }) ;            
        }) ;
    }) ;  
  
    it('should not follow redirect responses by default', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: uas1Config.sipAddress,
            remainInDialog: true
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-redirect-uas/app')(merge({
            contact: uas1Config.sipAddress
        }, uas1Config)) ;
        connectAll([uac, proxy, uas1], function(err){
            if( err ) throw err ;
            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                body: proxyConfig.sdp
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

    it('should follow redirect responses when configured to', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: uas1Config.sipAddress,
            remainInDialog: true,
            followRedirects: true
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-redirect-uas/app')(merge({
            contact: uas1Config.sipAddress
        }, uas1Config)) ;
        connectAll([uac, proxy, uas1], function(err){
            if( err ) throw err ;

            //
            //install a handler for the BYE request
            //
            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    setTimeout(function(){
                        proxy.idle.should.be.true; 
                        done() ;
                    }, 50) ;
                }) ;
            }) ;

            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                body: proxyConfig.sdp
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
    it('should support forking simultaneous INVITEs', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: [uas1Config.sipAddress,uas2Config.sipAddress],
            remainInDialog: true,
            followRedirects: true,
            forking:'simultaneous'
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-success-uas-bye/app')(merge({
            contact: uas1Config.sipAddress,
            answerDelay: 400
        }, uas1Config)) ;
        uas2 = require('../../examples/invite-cancel/app')(uas2Config) ;
        connectAll([uac, proxy, uas1, uas2], function(err){
            if( err ) throw err ;

            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    setTimeout(function(){
                        proxy.idle.should.be.true; 
                        uas1.idle.should.be.true ;
                        uas2.idle.should.be.true; 
                        done() ;
                    }, 50) ;
                }) ;
            }) ;

            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                body: proxyConfig.sdp,
                headers: {
                    'Subject': 'should support forking simultaneous INVITEs'
                }
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

    it('should generate CANCEL when late-arriving response comes in for transaction we have discarded', function(done) {
        uac = configureUac( uacConfig ) ;
        proxy = require('../../examples/proxy/app')(merge( {
            proxyTarget: [uas1Config.sipAddress,uas2Config.sipAddress],
            remainInDialog: true,
            followRedirects: true,
            forking:'simultaneous'
        }, proxyConfig)) ;
        uas1 = require('../../examples/invite-success-uas-bye/app')(merge({
            contact: uas1Config.sipAddress,
            answerDelay: 1
        }, uas1Config)) ;
        uas2 = require('../../examples/invite-cancel/app')(uas2Config) ;
        connectAll([uac, proxy, uas1, uas2], function(err){
            if( err ) throw err ;

            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    setTimeout(function(){
                        proxy.idle.should.be.true; 
                        uas1.idle.should.be.true ;
                        uas2.idle.should.be.true; 
                        done() ;
                    }, 50) ;
                }) ;
            }) ;

            uac.request({
                uri: proxyConfig.sipAddress,
                method: 'INVITE',
                body: proxyConfig.sdp,
                headers: {
                    'Subject': 'should generate CANCEL when late-arriving response comes in for transaction we have discarded'
                }
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
 /*
     
    it.only('should cancel multiple invites if necessary', function(done) {
        var mockedConfig = merge( {
            proxyTarget: [cfg.remote_uri2,cfg.remote_uri2,cfg.remote_uri2],
            remainInDialog: true,
            finalTimeout: '1s'
        }, cfg) ;
        uac = configureUac( config ) ;
        proxy = require('../../examples/proxy/app')(mockedConfig) ;
        uas1 = require('../../examples/invite-success-uas-bye/app')(merge({
            allowCancel: 2
        }, require('./fixtures/remoteConfig2') )) ;
        connectAll([uac, proxy, uas1], function(err){
            if( err ) throw err ;
            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    setTimeout(function(){
                        proxy.idle.should.be.true; 
                        done() ;
                    }, 50) ;
                }) ;
            }) ;

            uac.request({
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

    it('should support a provisional timeout in seconds', function(done) {
        remoteAgent.disconnect() ;
        remoteAgent2.disconnect() ;
        var mockedConfig = merge( {
            proxyTarget: ['sip:nobody@127.0.0.1:6060',cfg.remote_uri2],
            remainInDialog: true,
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
            remainInDialog: true,
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
            remainInDialog: true,
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
*/
}) ;
