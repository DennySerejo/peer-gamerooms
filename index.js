var ExpressPeerServer = require('peer').ExpressPeerServer;
var Lobby = require('src/server/Lobby');
var options = {
    allow_discovery:true
}
module.exports = function(http){
    var peerjs = ExpressPeerServer(http, options)
    app.use('/peerjs', peerjs);
    return new Lobby(http,peerjs);
}
