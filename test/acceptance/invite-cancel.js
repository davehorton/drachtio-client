var assert = require('assert');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var should = require('should');
var config = require('./fixtures/localConfig');
var fs = require('fs') ;
var localAgent;
var remoteAgent;

var noop = function(req,res){} ;

describe('cancel an invite in progress', function() {
    this.timeout(3000) ;

    before(function(done){
        var mockedConfig = require('./fixtures/remoteConfig') ;
       remoteAgent = require('../../examples/invite-cancel/app')(mockedConfig) ;
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
        done() ;
    }) ;
 
    it('must be able to generate an INVITE then cancel it before answer', function(done) {
        //
        //send INVITE
        //
        localAgent.request({
            uri: config.request_uri,
            method: 'INVITE',
            body: config.sdp
        }, function( err, req ) {
            should.not.exist(err) ;
            //
            //wait for response
            //
            req.on('response', function(res, ack){
                //
                //wait for provisional response and then cancel
                //
                if( res.status === 180 ) {
                    req.cancel(function(err, cancel){
                        should.not.exist(err) ;
                    }) ;                
                }
                else {
                    res.should.have.property('status',487);
                    localAgent.idle.should.be.true ;
                    remoteAgent.idle.should.be.true ;
                    done() ;
                }
            }) ;
        }) ;
    }) ;
}) ;
