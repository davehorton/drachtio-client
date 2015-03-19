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

var uacServer, uasServer ;
var uac, uas;
var uacConfig, uasConfig;

uacConfig = require('./fixtures/localConfig') ;
uasConfig = require('./fixtures/remoteConfig') ;

uacConfig.connect_opts.port = 8040; uacConfig.sipAddress = 'sip:127.0.0.1:6070';
uasConfig.connect_opts.port = 8041; uasConfig.sipAddress = 'sip:127.0.0.1:6071';

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

describe('uas / uas', function() {
    this.timeout(6000) ;

     before(function(done){
        exec('pkill drachtio', function () {
            uacServer = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.local.xml','-p',8040,'-c','sip:127.0.0.1:6070'],{cwd: process.cwd() + '/test/acceptance'}) ;
            uasServer = spawn('drachtio',
                ['-f','./fixtures/drachtio.conf.remote.xml','-p',8041,'-c','sip:127.0.0.1:6071'],{cwd: process.cwd() + '/test/acceptance'}) ;
            done() ;
        }) ;
    }) ;
    after(function(done){
        debug('turning down servers') ;
        this.timeout(1000) ;
        setTimeout( function() {
            uacServer.kill() ;
            uasServer.kill() ;
            done() ;
        }, 250) ;
    }) ;
 
    it('should be able to set a custom header', function(done) {
        uac = configureUac( uacConfig ) ;
        uas = require('../../examples/custom-headers/app')(require('./fixtures/remoteConfig')) ;
        connectAll([uac, uas], function(err){
            if( err ) throw err ;
            uac.request({
                uri: uasConfig.sipAddress,
                method: 'OPTIONS'
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
    it('must be able to set a well-known header', function(done) {
        uac = configureUac( uacConfig ) ;
        uas = require('../../examples/custom-headers/app')(require('./fixtures/remoteConfig')) ;
        connectAll([uac, uas], function(err){
            if( err ) throw err ;
            uac.request({
                uri: uasConfig.sipAddress,
                method: 'MESSAGE'
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
    it('must be able to reject an INVITE', function(done) {
        uac = configureUac( uacConfig ) ;
        uas = require('../../examples/invite-non-success/app')(merge({status: 486}, require('./fixtures/remoteConfig'))) ;
        connectAll([uac, uas], function(err){
            if( err ) throw err ;
            uac.request({
                uri: uasConfig.sipAddress,
                method: 'INVITE',
                body: uacConfig.sdp
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
    it('must be able to cancel an INVITE', function(done) {
        uac = configureUac( uacConfig ) ;
        uas = require('../../examples/invite-cancel/app')(require('./fixtures/remoteConfig')) ;
        connectAll([uac, uas], function(err){
            if( err ) throw err ;
            uac.request({
                uri: uasConfig.sipAddress,
                method: 'INVITE',
                body: uacConfig.sdp
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
    it('invite success then uas sends bye', function(done) {
        uac = configureUac( uacConfig ) ;
        uas = require('../../examples/invite-success-uas-bye/app')(require('./fixtures/remoteConfig')) ;
        connectAll([uac, uas], function(err){
            if( err ) throw err ;

            uac.set('handler', function( req, res){
                req.method.should.eql('BYE') ;
                res.send(200, function(err, bye){
                    should.not.exist(err) ;
                    uac.idle.should.be.true; 
                    setTimeout(function(){
                        uas.idle.should.be.true; 
                        done() ;
                    }, 50) ;
                }) ;
            }) ;
            uac.request({
                uri: uasConfig.sipAddress,
                method: 'INVITE',
                body: uacConfig.sdp
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
    it('invite success then uac sends bye', function(done) {
        uac = configureUac( uacConfig ) ;
        uas = require('../../examples/invite-success-uac-bye/app')(require('./fixtures/remoteConfig')) ;
        connectAll([uac, uas], function(err){
            if( err ) throw err ;

            uac.request({
                uri: uasConfig.sipAddress,
                method: 'INVITE',
                body: uacConfig.sdp
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
                                uas.idle.should.be.true ;
                                done() ;
                            }) ;
                        }) ;
                    }, 1) ;
                }) ;
            }) ;
        }) ;
    }) ;    
    it('invite with reliable provisional responses', function(done) {
        uac = configureUac( uacConfig ) ;
        uas = require('../../examples/invite-100rel/app')(require('./fixtures/remoteConfig')) ;
        connectAll([uac, uas], function(err){
            if( err ) throw err ;

            uac.request({
                uri: uasConfig.sipAddress,
                method: 'INVITE',
                headers: {
                    'Require': '100rel'
                },
                body: uacConfig.sdp
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
                                    uas.idle.should.be.true ;
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
