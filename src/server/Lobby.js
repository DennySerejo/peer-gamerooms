'use strict';
let _ = require('../util');
let io = require('socket.io');
var Room = require('./Room');

let _options = {
    path: '/lobby'
};
let Lobby = function(server,peerjs,options){
    _.extend(_options,options);
    this.peerjs = peerjs;
    this.roomIds = peerjs._options.keys;
    this.rooms = {};
    this._wss = io.listen(server,{ path: _options.path});
    this._wss.on('connection',this.onconnection.bind(this));
};
Lobby.prototype.onconnection = function(socket){
    console.log("New client connected",socket.id)
    socket.on('rooms',(d,ack)=>{this.ackDataOrError(socket,this.allRooms(),ack)})
    socket.on('create-room',(d,ack)=>{this.ackDataOrError(socket,this.createRoom(d),ack)})
    socket.on('quick-find',(d,ack)=>{this.ackDataOrError(socket,this.quickFind(d),ack)})
    socket.on('join-room',(d,ack)=>{this.ackDataOrError(socket,this.joinRoom(d),ack)})
    socket.on('start-room',(d,ack)=>{this.ackDataOrError(socket,this.startRoom(d),ack)})

};
Lobby.prototype.allRooms = function(){
    var resp = {};
    for (var room in this.rooms) {
        resp[room] = this.rooms[room].toObject();
    }
    return resp;
};
Lobby.prototype.createRoom = function(id){
    id = id || _.randomId();
    if(!this._checkRoomId()){
        return {err:Lobby.err.type.invalid_roomid}
    }
    this.roomIds.push(id);
    this.rooms[id] = new Room(this,id);
    return id;
};
Lobby.prototype.quickFind = function(){
    for(var room in this.rooms){
        if(this.rooms[room].canJoin()){
            return {id:room,started:this.rooms[room].started,host:this.rooms[room].host};
        }
    }
    return {id:this.createRoom()};
};
Lobby.prototype.joinRoom = function(id){
    if(!this.rooms[id])
        return {err:Lobby.err.type.invalid_roomid};
    if(!this.rooms[id].canJoin())
        return {err:Lobby.err.type.room_full};
    return true;
};
Lobby.prototype._checkRoomId = function(id){
    return this.roomIds.indexOf(id)<0;
};
Lobby.prototype.startRoom = function(id){
    if(this.rooms[id]){

        this.rooms[id].start();
        return true;
    }
    return {err:Lobby.err.type.invalid_roomid}
};
Lobby.prototype.ackDataOrError = function(socket,data,ack){
    if(!data.err)
        ack && ack(data);
    else socket.emit('lobby-error',data);
};
Lobby.err = {
    type:{
        invalid_roomid:'invalid_roomid',
        room_full:'room_full'
    }
};

module.exports = Lobby;