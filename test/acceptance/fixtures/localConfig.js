module.exports =  {
	request_uri: 'sip:1234@127.0.0.1:5061'
        ,connect_opts: {
                host: '127.0.0.1'
                ,port: 8022
                ,secret: 'cymru'                
        }
        ,connect_opts2: {
                host: '127.0.0.1'
                ,port: 8024
                ,secret: 'cymru'                
        }
	,sdp: 'v=0\n' +
        'o=- 1385064302543926 1 IN IP4 127.0.0.1\n' + 
        's=Bria 3 release 3.5.5 stamp 71243\n' + 
        'c=IN IP4 127.0.0.1\n' + 
        't=0 0\n' + 
        'm=audio 65001 RTP/AVP 123 121 9 0 8 18 101\n' + 
        'a=rtpmap:123 opus/48000/2\n' + 
        'a=fmtp:123 useinbandfec=1\n' + 
        'a=rtpmap:121 SILK/16000\n' + 
        'a=rtpmap:18 G729/8000\n' + 
        'a=fmtp:18 annexb=yes\n' + 
        'a=rtpmap:101 telephone-event/8000\n' + 
        'a=fmtp:101 0-15\n' + 
        'a=sendrecv\n', 
        apiLog: '/tmp/api_local.txt'

} ;
