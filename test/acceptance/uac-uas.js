var assert = require('assert');
var should = require('should');
var merge = require('merge') ;
var debug = require('debug')('drachtio-client') ;
var Agent = require('../..').Agent ;
var fixture = require('drachtio-test-fixtures') ;
var uac, uas ;
var cfg = fixture(__dirname,[8050,8051],[6050,6051]) ;

describe('uac / uas scenarios', function() {
    this.timeout(6000) ;

    before(function(done){
        cfg.startServers(done) ;
    }) ;
    after(function(done){
        cfg.stopServers(done) ;
    }) ;
 
    it('should be able to set a custom header', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        uas = require('../scripts/custom-headers/app')(cfg.client[1]) ;
        cfg.connectAll([uac, uas], function(err){
            if( err ) throw err ;
            uac.request({
                uri: cfg.sipServer[1],
                method: 'OPTIONS',
                headers: {
                    Subject: self.test.fullTitle()
                }
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res){
                    res.should.have.property('status',200); 
                    res.get('X-Custom').should.eql('drachtio rocks!') ;
                    uac.idle.should.be.true ;
                    uas.idle.should.be.true ;
                    done() ;
                }) ;
            }) ;
        }) ;
    }) ;    
    it('should be able to set a well-known header', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        uas = require('../scripts/custom-headers/app')(cfg.client[1]) ;
        cfg.connectAll([uac, uas], function(err){
            if( err ) throw err ;
            uac.request({
                uri: cfg.sipServer[1],
                method: 'MESSAGE',
                headers: {
                    Subject: self.test.fullTitle()
                }
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res){
                    res.should.have.property('status',200); 
                    res.get('Subject').should.eql('pure awesomeness') ;
                    uac.idle.should.be.true ;
                    uas.idle.should.be.true ;
                    done() ;
                }) ;
            }) ;
        }) ;
    }) ;    
    it('should be able to reject an INVITE', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        uas = require('../scripts/invite-non-success/app')(merge({status:486}, cfg.client[1])) ;
        cfg.connectAll([uac, uas], function(err){
            if( err ) throw err ;
            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                body: cfg.client[0].sdp,
                headers: {
                    Subject: self.test.fullTitle()
                }
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res, ack){
                    res.should.have.property('status',486); 
                    uac.idle.should.be.true ;
                    uas.idle.should.be.true ;
                    done() ;
                }) ;
            }) ;
        }) ;
    }) ;
    it('should be able to cancel an INVITE', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        uas = require('../scripts/invite-cancel/app')(cfg.client[1]) ;
        cfg.connectAll([uac, uas], function(err){
            if( err ) throw err ;
            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                body: cfg.client[0].sdp,
                headers: {
                    Subject: self.test.fullTitle()
                }
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res, ack){
                    if( res.status === 180 ) {
                        req.cancel(function(err, cancel){
                            should.not.exist(err) ;
                        }) ;                
                    }
                    else {
                        res.should.have.property('status',487);
                        uac.idle.should.be.true ;
                        uas.idle.should.be.true ;
                        done() ;
                    }
                }) ;
            }) ;
        }) ;
    }) ;    
    it('should connect a call and allow tear down from UAS side', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        uas = require('../scripts/invite-success-uas-bye/app')(cfg.client[1]) ;
        cfg.connectAll([uac, uas], function(err){
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
                body: cfg.client[0].sdp,
                headers: {
                    Subject: self.test.fullTitle()
                }
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res, ack){
                    //
                    //validate response and send ack
                    //
                    res.should.have.property('status',200);
                    ack() ; 
                }) ;
            }) ;
        }) ;
    }) ;    
    it('should connect a call and allow tear down from UAC side', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        uas = require('../scripts/invite-success-uac-bye/app')(cfg.client[1]) ;
        cfg.connectAll([uac, uas], function(err){
            if( err ) throw err ;

            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                body: cfg.client[0].sdp,
                headers: {
                    Subject: self.test.fullTitle()
                }
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res, ack){
                    res.should.have.property('status',200);
                    ack() ; 
                    
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
                }) ;
            }) ;
        }) ;
    }) ;    
    it('should be able to connect a call with a reliable provisional response', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        uas = require('../scripts/invite-100rel/app')(cfg.client[1]) ;
        cfg.connectAll([uac, uas], function(err){
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
                        res.get('Require').should.eql('100rel') ;
                        ack() ;
                    }
                    if( res.status >= 200 ) {
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
    it.only('should handle reINVITEs', function(done) {
        var self = this ;
        uac = cfg.configureUac( cfg.client[0], Agent ) ;
        uas = require('../scripts/invite-success-uac-reinvite-bye/app')(cfg.client[1]) ;
        cfg.connectAll([uac, uas], function(err){
            if( err ) throw err ;

            uac.request({
                uri: cfg.sipServer[1],
                method: 'INVITE',
                body: cfg.client[0].sdp,
                headers: {
                    Subject: self.test.fullTitle()
                }
            }, function( err, req ) {
                should.not.exist(err) ;
                req.on('response', function(res, ack){
                    res.should.have.property('status',200);
                    res.body.should.not.be.empty ;
                    ack() ; 

                    setTimeout( function() {
                        //send reINVITE
                        uac.request({
                            uri: cfg.sipServer[1],
                            method: 'INVITE',
                            stackDialogId: res.stackDialogId,
                            body: cfg.client[0].sdp,
                            headers: {
                                Subject: self.test.fullTitle() + ' reinvite'
                            }
                        }, function( err, req ) {
                            res.should.have.property('status',200);
                            

                            req.on('response', function(res, ack){
                                res.should.have.property('status',200);
                                res.body.should.not.be.empty ;
                                ack() ; 

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

                            }) ;
                        }) ;
                    }, 1) ;                    
                }) ;
            }) ;
        }) ;
    }) ;    
}) ;
