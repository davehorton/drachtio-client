var assert = require('assert');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var should = require('should');
var config = require('./fixtures/localConfig');
var fs = require('fs') ;
var localAgent;
var remoteAgent;

var noop = function(req,res){} ;

describe('invite with reliable provisional responses', function() {
    this.timeout(3000) ;

    before(function(done){
        var mockedConfig = require('./fixtures/remoteConfig') ;
       remoteAgent = require('../../examples/invite-100rel/app')(mockedConfig) ;
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
 
    it('must be able to complete an INVITE with 100rel', function(done) {
        //
        //send INVITE
        //
        localAgent.request({
            uri: config.request_uri,
            method: 'INVITE',
            body: config.sdp,
            headers: {
                'Require': '100rel'
            }
        }, function( err, req ) {
            should.not.exist(err) ;
            //
            //wait for response
            //
            req.on('response', function(res, ack){
                //
                //validate response and send prack to 183 and ack to 200 OK
                //
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
