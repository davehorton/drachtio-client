var assert = require('assert');
var should = require('should');
var merge = require('merge') ;
var debug = require('debug')('drachtio-client') ;
var Agent = require('../..').Agent ;
var fixture = require('drachtio-test-fixtures') ;
var uac, proxy, uas ;
var cfg = fixture(__dirname,[8060,8061,8062],[6060,6061,6062]) ;

describe('proxy scenarios', function() {
    this.timeout(6000) ;

    before(function(done){
        cfg.startServers(done) ;
    }) ;
    after(function(done){
        cfg.stopServers(done) ;
    }) ;
 
    it('should respond 483 Too Many Hops when Max-Forwards is 0', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        proxy = require('../../examples/proxy/app')(merge({proxyTarget: cfg.sipServer[2], remainInDialog: true, label: this.test.fullTitle()}, cfg.client[1])); 
        cfg.connectAll( [uac, proxy], function(err){
            if( err ) throw err ;            
            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                headers: {
                    'Max-Forwards': 0,
                    'Subject': self.test.fullTitle()
                },
                body: cfg.client[0].sdp
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res){
                    res.should.have.property('status',483); 
                    uac.idle.should.be.true ;
                    done() ;                        
                }) ;
            }) ;
        }) ;
    }) ;

    it('should decrement Max-Forwards when provided', function(done) {
        var self = this 
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        proxy = require('../../examples/proxy/app')(merge({proxyTarget: cfg.sipServer[2], remainInDialog: false}, cfg.client[1])); 
        uas = require('../../examples/invite-success-uas-bye/app')(cfg.client[2]) ;
        cfg.connectAll([uac, proxy, uas], function(err){
            if( err )  throw err ;
            //
            //install a handler for the BYE request
            //
            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    done() ;
                }) ;
            }) ;

            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                headers: {
                    'Max-Forwards': 11,
                    'Subject': self.test.fullTitle()
                },
                body: cfg.client[0].sdp
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
        var self = this 
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        proxy = require('../../examples/proxy/app')(merge({proxyTarget: cfg.sipServer[2], remainInDialog: true}, cfg.client[1])); 
        uas = require('../../examples/invite-success-uas-bye/app')(cfg.client[2]) ;
        cfg.connectAll([uac, proxy, uas], function(err){
            if( err ) throw err ;
            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    done() ;
                }) ;
            }) ;

            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                headers: {
                    'Subject' :self.test.fullTitle()
                },
                body: cfg.client[0].sdp
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
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        proxy = require('../../examples/proxy/app')(merge({proxyTarget: cfg.sipServer[2], remainInDialog: false}, cfg.client[1])); 
        uas = require('../../examples/invite-success-uas-bye/app')(cfg.client[2]) ;
        cfg.connectAll([uac, proxy, uas], function(err){
            if( err ) throw err ;
            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    done() ;
                }) ;
            }) ;

            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                headers: {
                    'Subject' : self.test.fullTitle()
                },
                body: cfg.client[0].sdp
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res, ack){
                    res.should.have.property('status',200); 
                    should.not.exist( res.get('Record-Route') ) ;
                    ack() ;
                }) ;
            }) ;            
        }) ;
    }) ; 
    
    it('should not add Record-Route header by default', function(done) {
        var self = this;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        proxy = require('../../examples/proxy/app')(merge({proxyTarget: cfg.sipServer[2]}, cfg.client[1])); 
        uas = require('../../examples/invite-success-uas-bye/app')(cfg.client[2]) ;
        cfg.connectAll([uac, proxy, uas], function(err){
            if( err ) throw err ;
            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    done() ;
                }) ;
            }) ;

            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                headers: {
                    'Subject': self.test.fullTitle()
                },
                body: cfg.client[0].sdp
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res, ack){
                    res.should.have.property('status',200); 
                    should.not.exist( res.get('Record-Route') ) ;
                    ack() ;
                }) ;
            }) ;            
        }) ;
    }) ;    

    it('should handle handle reliable provisional responses', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        proxy = require('../../examples/proxy/app')(merge({proxyTarget: cfg.sipServer[2], remainInDialog: true}, cfg.client[1])); 
        uas = require('../../examples/invite-100rel/app')(cfg.client[2]) ;
        cfg.connectAll([uac, proxy, uas], function(err){
            if( err ) throw err ;
            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                headers: {
                    'Require': '100rel',
                    'Subject': self.test.fullTitle()
                },
                body: cfg.client[0].sdp
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
                                    done() ;
                                }) ;
                            }) ;
                        }, 1) ;
                    }
                }) ;
            }) ;            
        }) ;
    }) ;  
/*  
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
