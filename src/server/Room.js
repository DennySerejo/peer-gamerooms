var _ = require('../util');

var Room = function(lobby,id,options){
    lobby.peerjs._clients[id] = lobby.peerjs._clients[id] || {};
    this.peers = lobby.peerjs._clients[id];
    this._peerjs = lobby.peerjs;
    this._lobby = lobby;
    this.id = id;
    this.host = null;
    this.secondaryHost = null;
    this._options = _.extend({
        maxPeers: 10,
        destroyOnEmpty:true
    },options)
    this._listenPeerJSEvents()
    // this._interval = setInterval(this._checkIsEmpty.bind(this),1000);
};
Room.err = {
    type:{
        room_empty:'room_empty'
    }
};
Room.prototype._listenPeerJSEvents = function(){
    this._peerjs.on('disconnect',(id,key) => {
        if(key == this.id)
            this._checkIsEmpty();
        if(id === this.host){
            this._updateHost(this.secondaryhost);
        }
    })
    this._peerjs.on('connection',(id,key) => {
        console.log('peer connected',id);
        if(this.started){
            this.suggestConnection(this.host,id);
            this.suggestConnection(this.secondaryhost,id);
            this.sendTo(id,'set-host',this.host);
        }
        else{
            if(this.count()>1){
                this.sendTo(id,'can-start');
            }

        }
    })
};
Room.prototype._checkIsEmpty = function(){
    if(this._options.destroyOnEmpty && this.count() === 0){
        this.destroy();
    }
};
Room.prototype.count = function(){
    return Object.keys(this.peers).length
};

Room.prototype.destroy = function(){
    clearInterval(this._interval);
    delete this._lobby.rooms[this.id]

};
Room.prototype.toObject = function(){
    return {
        id:this.id,
        maxPeers: this._options.maxPeers,
        host: this.host,
        peers: Object.keys(this.peers).length
    }
};
Room.prototype.canJoin = function(){
    return this.count() < this._options.maxPeers;
};
Room.prototype.start = function(){
    console.log('starting room');
    if(this.count()<=1) return {err:this.err.type.room_empty};
    this._updateHost();
    this._connectHost(this.host);
    this._connectHost(this.secondaryhost,this.host);
    this.started = true;

    return 1;
};

Room.prototype._updateHost = function(peer){
    peer = peer || Object.keys(this.peers)[0]
    this.host = peer
    for(var id in this.peers){
        if(id !== this.host){
            this.secondaryhost = id;
            break;
        }

    }
    this.broadcast('set-host',this.host);
};

Room.prototype.broadcast = function(event,data){
    for(var id in this.peers){
        this.sendTo(id,event,data);
    }
};
Room.prototype.sendTo = function(peer,event,data){
    this._lobby._wss.sockets.connected[peer] &&
    this._lobby._wss.sockets.connected[peer].emit(event,data);
};
Room.prototype._connectHost = function(host,other){

    for(var peer in this.peers){
        if(peer !== host && (!other || peer !== other))
            this.sendTo(host,'connect-to',peer);
    }
};
Room.prototype.suggestConnection = function(peer1,peer2){
    this.sendTo(peer1,'connect-to',peer2)
};
module.exports = Room;