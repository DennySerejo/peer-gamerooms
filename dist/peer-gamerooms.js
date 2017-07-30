(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var BufferBuilder = require('./bufferbuilder').BufferBuilder;
var binaryFeatures = require('./bufferbuilder').binaryFeatures;

var BinaryPack = {
  unpack: function(data){
    var unpacker = new Unpacker(data);
    return unpacker.unpack();
  },
  pack: function(data){
    var packer = new Packer();
    packer.pack(data);
    var buffer = packer.getBuffer();
    return buffer;
  }
};

module.exports = BinaryPack;

function Unpacker (data){
  // Data is ArrayBuffer
  this.index = 0;
  this.dataBuffer = data;
  this.dataView = new Uint8Array(this.dataBuffer);
  this.length = this.dataBuffer.byteLength;
}

Unpacker.prototype.unpack = function(){
  var type = this.unpack_uint8();
  if (type < 0x80){
    var positive_fixnum = type;
    return positive_fixnum;
  } else if ((type ^ 0xe0) < 0x20){
    var negative_fixnum = (type ^ 0xe0) - 0x20;
    return negative_fixnum;
  }
  var size;
  if ((size = type ^ 0xa0) <= 0x0f){
    return this.unpack_raw(size);
  } else if ((size = type ^ 0xb0) <= 0x0f){
    return this.unpack_string(size);
  } else if ((size = type ^ 0x90) <= 0x0f){
    return this.unpack_array(size);
  } else if ((size = type ^ 0x80) <= 0x0f){
    return this.unpack_map(size);
  }
  switch(type){
    case 0xc0:
      return null;
    case 0xc1:
      return undefined;
    case 0xc2:
      return false;
    case 0xc3:
      return true;
    case 0xca:
      return this.unpack_float();
    case 0xcb:
      return this.unpack_double();
    case 0xcc:
      return this.unpack_uint8();
    case 0xcd:
      return this.unpack_uint16();
    case 0xce:
      return this.unpack_uint32();
    case 0xcf:
      return this.unpack_uint64();
    case 0xd0:
      return this.unpack_int8();
    case 0xd1:
      return this.unpack_int16();
    case 0xd2:
      return this.unpack_int32();
    case 0xd3:
      return this.unpack_int64();
    case 0xd4:
      return undefined;
    case 0xd5:
      return undefined;
    case 0xd6:
      return undefined;
    case 0xd7:
      return undefined;
    case 0xd8:
      size = this.unpack_uint16();
      return this.unpack_string(size);
    case 0xd9:
      size = this.unpack_uint32();
      return this.unpack_string(size);
    case 0xda:
      size = this.unpack_uint16();
      return this.unpack_raw(size);
    case 0xdb:
      size = this.unpack_uint32();
      return this.unpack_raw(size);
    case 0xdc:
      size = this.unpack_uint16();
      return this.unpack_array(size);
    case 0xdd:
      size = this.unpack_uint32();
      return this.unpack_array(size);
    case 0xde:
      size = this.unpack_uint16();
      return this.unpack_map(size);
    case 0xdf:
      size = this.unpack_uint32();
      return this.unpack_map(size);
  }
}

Unpacker.prototype.unpack_uint8 = function(){
  var byte = this.dataView[this.index] & 0xff;
  this.index++;
  return byte;
};

Unpacker.prototype.unpack_uint16 = function(){
  var bytes = this.read(2);
  var uint16 =
    ((bytes[0] & 0xff) * 256) + (bytes[1] & 0xff);
  this.index += 2;
  return uint16;
}

Unpacker.prototype.unpack_uint32 = function(){
  var bytes = this.read(4);
  var uint32 =
     ((bytes[0]  * 256 +
       bytes[1]) * 256 +
       bytes[2]) * 256 +
       bytes[3];
  this.index += 4;
  return uint32;
}

Unpacker.prototype.unpack_uint64 = function(){
  var bytes = this.read(8);
  var uint64 =
   ((((((bytes[0]  * 256 +
       bytes[1]) * 256 +
       bytes[2]) * 256 +
       bytes[3]) * 256 +
       bytes[4]) * 256 +
       bytes[5]) * 256 +
       bytes[6]) * 256 +
       bytes[7];
  this.index += 8;
  return uint64;
}


Unpacker.prototype.unpack_int8 = function(){
  var uint8 = this.unpack_uint8();
  return (uint8 < 0x80 ) ? uint8 : uint8 - (1 << 8);
};

Unpacker.prototype.unpack_int16 = function(){
  var uint16 = this.unpack_uint16();
  return (uint16 < 0x8000 ) ? uint16 : uint16 - (1 << 16);
}

Unpacker.prototype.unpack_int32 = function(){
  var uint32 = this.unpack_uint32();
  return (uint32 < Math.pow(2, 31) ) ? uint32 :
    uint32 - Math.pow(2, 32);
}

Unpacker.prototype.unpack_int64 = function(){
  var uint64 = this.unpack_uint64();
  return (uint64 < Math.pow(2, 63) ) ? uint64 :
    uint64 - Math.pow(2, 64);
}

Unpacker.prototype.unpack_raw = function(size){
  if ( this.length < this.index + size){
    throw new Error('BinaryPackFailure: index is out of range'
      + ' ' + this.index + ' ' + size + ' ' + this.length);
  }
  var buf = this.dataBuffer.slice(this.index, this.index + size);
  this.index += size;

    //buf = util.bufferToString(buf);

  return buf;
}

Unpacker.prototype.unpack_string = function(size){
  var bytes = this.read(size);
  var i = 0, str = '', c, code;
  while(i < size){
    c = bytes[i];
    if ( c < 128){
      str += String.fromCharCode(c);
      i++;
    } else if ((c ^ 0xc0) < 32){
      code = ((c ^ 0xc0) << 6) | (bytes[i+1] & 63);
      str += String.fromCharCode(code);
      i += 2;
    } else {
      code = ((c & 15) << 12) | ((bytes[i+1] & 63) << 6) |
        (bytes[i+2] & 63);
      str += String.fromCharCode(code);
      i += 3;
    }
  }
  this.index += size;
  return str;
}

Unpacker.prototype.unpack_array = function(size){
  var objects = new Array(size);
  for(var i = 0; i < size ; i++){
    objects[i] = this.unpack();
  }
  return objects;
}

Unpacker.prototype.unpack_map = function(size){
  var map = {};
  for(var i = 0; i < size ; i++){
    var key  = this.unpack();
    var value = this.unpack();
    map[key] = value;
  }
  return map;
}

Unpacker.prototype.unpack_float = function(){
  var uint32 = this.unpack_uint32();
  var sign = uint32 >> 31;
  var exp  = ((uint32 >> 23) & 0xff) - 127;
  var fraction = ( uint32 & 0x7fffff ) | 0x800000;
  return (sign == 0 ? 1 : -1) *
    fraction * Math.pow(2, exp - 23);
}

Unpacker.prototype.unpack_double = function(){
  var h32 = this.unpack_uint32();
  var l32 = this.unpack_uint32();
  var sign = h32 >> 31;
  var exp  = ((h32 >> 20) & 0x7ff) - 1023;
  var hfrac = ( h32 & 0xfffff ) | 0x100000;
  var frac = hfrac * Math.pow(2, exp - 20) +
    l32   * Math.pow(2, exp - 52);
  return (sign == 0 ? 1 : -1) * frac;
}

Unpacker.prototype.read = function(length){
  var j = this.index;
  if (j + length <= this.length) {
    return this.dataView.subarray(j, j + length);
  } else {
    throw new Error('BinaryPackFailure: read index out of range');
  }
}

function Packer(){
  this.bufferBuilder = new BufferBuilder();
}

Packer.prototype.getBuffer = function(){
  return this.bufferBuilder.getBuffer();
}

Packer.prototype.pack = function(value){
  var type = typeof(value);
  if (type == 'string'){
    this.pack_string(value);
  } else if (type == 'number'){
    if (Math.floor(value) === value){
      this.pack_integer(value);
    } else{
      this.pack_double(value);
    }
  } else if (type == 'boolean'){
    if (value === true){
      this.bufferBuilder.append(0xc3);
    } else if (value === false){
      this.bufferBuilder.append(0xc2);
    }
  } else if (type == 'undefined'){
    this.bufferBuilder.append(0xc0);
  } else if (type == 'object'){
    if (value === null){
      this.bufferBuilder.append(0xc0);
    } else {
      var constructor = value.constructor;
      if (constructor == Array){
        this.pack_array(value);
      } else if (constructor == Blob || constructor == File) {
        this.pack_bin(value);
      } else if (constructor == ArrayBuffer) {
        if(binaryFeatures.useArrayBufferView) {
          this.pack_bin(new Uint8Array(value));
        } else {
          this.pack_bin(value);
        }
      } else if ('BYTES_PER_ELEMENT' in value){
        if(binaryFeatures.useArrayBufferView) {
          this.pack_bin(new Uint8Array(value.buffer));
        } else {
          this.pack_bin(value.buffer);
        }
      } else if (constructor == Object){
        this.pack_object(value);
      } else if (constructor == Date){
        this.pack_string(value.toString());
      } else if (typeof value.toBinaryPack == 'function'){
        this.bufferBuilder.append(value.toBinaryPack());
      } else {
        throw new Error('Type "' + constructor.toString() + '" not yet supported');
      }
    }
  } else {
    throw new Error('Type "' + type + '" not yet supported');
  }
  this.bufferBuilder.flush();
}


Packer.prototype.pack_bin = function(blob){
  var length = blob.length || blob.byteLength || blob.size;
  if (length <= 0x0f){
    this.pack_uint8(0xa0 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xda) ;
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xdb);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  this.bufferBuilder.append(blob);
}

Packer.prototype.pack_string = function(str){
  var length = utf8Length(str);

  if (length <= 0x0f){
    this.pack_uint8(0xb0 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xd8) ;
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xd9);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  this.bufferBuilder.append(str);
}

Packer.prototype.pack_array = function(ary){
  var length = ary.length;
  if (length <= 0x0f){
    this.pack_uint8(0x90 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xdc)
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xdd);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  for(var i = 0; i < length ; i++){
    this.pack(ary[i]);
  }
}

Packer.prototype.pack_integer = function(num){
  if ( -0x20 <= num && num <= 0x7f){
    this.bufferBuilder.append(num & 0xff);
  } else if (0x00 <= num && num <= 0xff){
    this.bufferBuilder.append(0xcc);
    this.pack_uint8(num);
  } else if (-0x80 <= num && num <= 0x7f){
    this.bufferBuilder.append(0xd0);
    this.pack_int8(num);
  } else if ( 0x0000 <= num && num <= 0xffff){
    this.bufferBuilder.append(0xcd);
    this.pack_uint16(num);
  } else if (-0x8000 <= num && num <= 0x7fff){
    this.bufferBuilder.append(0xd1);
    this.pack_int16(num);
  } else if ( 0x00000000 <= num && num <= 0xffffffff){
    this.bufferBuilder.append(0xce);
    this.pack_uint32(num);
  } else if (-0x80000000 <= num && num <= 0x7fffffff){
    this.bufferBuilder.append(0xd2);
    this.pack_int32(num);
  } else if (-0x8000000000000000 <= num && num <= 0x7FFFFFFFFFFFFFFF){
    this.bufferBuilder.append(0xd3);
    this.pack_int64(num);
  } else if (0x0000000000000000 <= num && num <= 0xFFFFFFFFFFFFFFFF){
    this.bufferBuilder.append(0xcf);
    this.pack_uint64(num);
  } else{
    throw new Error('Invalid integer');
  }
}

Packer.prototype.pack_double = function(num){
  var sign = 0;
  if (num < 0){
    sign = 1;
    num = -num;
  }
  var exp  = Math.floor(Math.log(num) / Math.LN2);
  var frac0 = num / Math.pow(2, exp) - 1;
  var frac1 = Math.floor(frac0 * Math.pow(2, 52));
  var b32   = Math.pow(2, 32);
  var h32 = (sign << 31) | ((exp+1023) << 20) |
      (frac1 / b32) & 0x0fffff;
  var l32 = frac1 % b32;
  this.bufferBuilder.append(0xcb);
  this.pack_int32(h32);
  this.pack_int32(l32);
}

Packer.prototype.pack_object = function(obj){
  var keys = Object.keys(obj);
  var length = keys.length;
  if (length <= 0x0f){
    this.pack_uint8(0x80 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xde);
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xdf);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  for(var prop in obj){
    if (obj.hasOwnProperty(prop)){
      this.pack(prop);
      this.pack(obj[prop]);
    }
  }
}

Packer.prototype.pack_uint8 = function(num){
  this.bufferBuilder.append(num);
}

Packer.prototype.pack_uint16 = function(num){
  this.bufferBuilder.append(num >> 8);
  this.bufferBuilder.append(num & 0xff);
}

Packer.prototype.pack_uint32 = function(num){
  var n = num & 0xffffffff;
  this.bufferBuilder.append((n & 0xff000000) >>> 24);
  this.bufferBuilder.append((n & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((n & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((n & 0x000000ff));
}

Packer.prototype.pack_uint64 = function(num){
  var high = num / Math.pow(2, 32);
  var low  = num % Math.pow(2, 32);
  this.bufferBuilder.append((high & 0xff000000) >>> 24);
  this.bufferBuilder.append((high & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((high & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((high & 0x000000ff));
  this.bufferBuilder.append((low  & 0xff000000) >>> 24);
  this.bufferBuilder.append((low  & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((low  & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((low  & 0x000000ff));
}

Packer.prototype.pack_int8 = function(num){
  this.bufferBuilder.append(num & 0xff);
}

Packer.prototype.pack_int16 = function(num){
  this.bufferBuilder.append((num & 0xff00) >> 8);
  this.bufferBuilder.append(num & 0xff);
}

Packer.prototype.pack_int32 = function(num){
  this.bufferBuilder.append((num >>> 24) & 0xff);
  this.bufferBuilder.append((num & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((num & 0x0000ff00) >>> 8);
  this.bufferBuilder.append((num & 0x000000ff));
}

Packer.prototype.pack_int64 = function(num){
  var high = Math.floor(num / Math.pow(2, 32));
  var low  = num % Math.pow(2, 32);
  this.bufferBuilder.append((high & 0xff000000) >>> 24);
  this.bufferBuilder.append((high & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((high & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((high & 0x000000ff));
  this.bufferBuilder.append((low  & 0xff000000) >>> 24);
  this.bufferBuilder.append((low  & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((low  & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((low  & 0x000000ff));
}

function _utf8Replace(m){
  var code = m.charCodeAt(0);

  if(code <= 0x7ff) return '00';
  if(code <= 0xffff) return '000';
  if(code <= 0x1fffff) return '0000';
  if(code <= 0x3ffffff) return '00000';
  return '000000';
}

function utf8Length(str){
  if (str.length > 600) {
    // Blob method faster for large strings
    return (new Blob([str])).size;
  } else {
    return str.replace(/[^\u0000-\u007F]/g, _utf8Replace).length;
  }
}

},{"./bufferbuilder":2}],2:[function(require,module,exports){
var binaryFeatures = {};
binaryFeatures.useBlobBuilder = (function(){
  try {
    new Blob([]);
    return false;
  } catch (e) {
    return true;
  }
})();

binaryFeatures.useArrayBufferView = !binaryFeatures.useBlobBuilder && (function(){
  try {
    return (new Blob([new Uint8Array([])])).size === 0;
  } catch (e) {
    return true;
  }
})();

module.exports.binaryFeatures = binaryFeatures;
var BlobBuilder = module.exports.BlobBuilder;
if (typeof window != 'undefined') {
  BlobBuilder = module.exports.BlobBuilder = window.WebKitBlobBuilder ||
    window.MozBlobBuilder || window.MSBlobBuilder || window.BlobBuilder;
}

function BufferBuilder(){
  this._pieces = [];
  this._parts = [];
}

BufferBuilder.prototype.append = function(data) {
  if(typeof data === 'number') {
    this._pieces.push(data);
  } else {
    this.flush();
    this._parts.push(data);
  }
};

BufferBuilder.prototype.flush = function() {
  if (this._pieces.length > 0) {
    var buf = new Uint8Array(this._pieces);
    if(!binaryFeatures.useArrayBufferView) {
      buf = buf.buffer;
    }
    this._parts.push(buf);
    this._pieces = [];
  }
};

BufferBuilder.prototype.getBuffer = function() {
  this.flush();
  if(binaryFeatures.useBlobBuilder) {
    var builder = new BlobBuilder();
    for(var i = 0, ii = this._parts.length; i < ii; i++) {
      builder.append(this._parts[i]);
    }
    return builder.getBlob();
  } else {
    return new Blob(this._parts);
  }
};

module.exports.BufferBuilder = BufferBuilder;

},{}],3:[function(require,module,exports){
module.exports.RTCSessionDescription = window.RTCSessionDescription ||
	window.mozRTCSessionDescription;
module.exports.RTCPeerConnection = window.RTCPeerConnection ||
	window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
module.exports.RTCIceCandidate = window.RTCIceCandidate ||
	window.mozRTCIceCandidate;

},{}],4:[function(require,module,exports){
var util = require('./util');
var EventEmitter = require('eventemitter3');
var Negotiator = require('./negotiator');
var Reliable = require('reliable');

/**
 * Wraps a DataChannel between two Peers.
 */
function DataConnection(peer, provider, options) {
  if (!(this instanceof DataConnection)) return new DataConnection(peer, provider, options);
  EventEmitter.call(this);

  this.options = util.extend({
    serialization: 'binary',
    reliable: false
  }, options);

  // Connection is not open yet.
  this.open = false;
  this.type = 'data';
  this.peer = peer;
  this.provider = provider;

  this.id = this.options.connectionId || DataConnection._idPrefix + util.randomToken();

  this.label = this.options.label || this.id;
  this.metadata = this.options.metadata;
  this.serialization = this.options.serialization;
  this.reliable = this.options.reliable;

  // Data channel buffering.
  this._buffer = [];
  this._buffering = false;
  this.bufferSize = 0;

  // For storing large data.
  this._chunkedData = {};

  if (this.options._payload) {
    this._peerBrowser = this.options._payload.browser;
  }

  Negotiator.startConnection(
    this,
    this.options._payload || {
      originator: true
    }
  );
}

util.inherits(DataConnection, EventEmitter);

DataConnection._idPrefix = 'dc_';

/** Called by the Negotiator when the DataChannel is ready. */
DataConnection.prototype.initialize = function(dc) {
  this._dc = this.dataChannel = dc;
  this._configureDataChannel();
}

DataConnection.prototype._configureDataChannel = function() {
  var self = this;
  if (util.supports.sctp) {
    this._dc.binaryType = 'arraybuffer';
  }
  this._dc.onopen = function() {
    util.log('Data channel connection success');
    self.open = true;
    self.emit('open');
  }

  // Use the Reliable shim for non Firefox browsers
  if (!util.supports.sctp && this.reliable) {
    this._reliable = new Reliable(this._dc, util.debug);
  }

  if (this._reliable) {
    this._reliable.onmessage = function(msg) {
      self.emit('data', msg);
    };
  } else {
    this._dc.onmessage = function(e) {
      self._handleDataMessage(e);
    };
  }
  this._dc.onclose = function(e) {
    util.log('DataChannel closed for:', self.peer);
    self.close();
  };
}

// Handles a DataChannel message.
DataConnection.prototype._handleDataMessage = function(e) {
  var self = this;
  var data = e.data;
  var datatype = data.constructor;
  if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
    if (datatype === Blob) {
      // Datatype should never be blob
      util.blobToArrayBuffer(data, function(ab) {
        data = util.unpack(ab);
        self.emit('data', data);
      });
      return;
    } else if (datatype === ArrayBuffer) {
      data = util.unpack(data);
    } else if (datatype === String) {
      // String fallback for binary data for browsers that don't support binary yet
      var ab = util.binaryStringToArrayBuffer(data);
      data = util.unpack(ab);
    }
  } else if (this.serialization === 'json') {
    data = JSON.parse(data);
  }

  // Check if we've chunked--if so, piece things back together.
  // We're guaranteed that this isn't 0.
  if (data.__peerData) {
    var id = data.__peerData;
    var chunkInfo = this._chunkedData[id] || {data: [], count: 0, total: data.total};

    chunkInfo.data[data.n] = data.data;
    chunkInfo.count += 1;

    if (chunkInfo.total === chunkInfo.count) {
      // Clean up before making the recursive call to `_handleDataMessage`.
      delete this._chunkedData[id];

      // We've received all the chunks--time to construct the complete data.
      data = new Blob(chunkInfo.data);
      this._handleDataMessage({data: data});
    }

    this._chunkedData[id] = chunkInfo;
    return;
  }

  this.emit('data', data);
}

/**
 * Exposed functionality for users.
 */

/** Allows user to close connection. */
DataConnection.prototype.close = function() {
  if (!this.open) {
    return;
  }
  this.open = false;
  Negotiator.cleanup(this);
  this.emit('close');
}

/** Allows user to send data. */
DataConnection.prototype.send = function(data, chunked) {
  if (!this.open) {
    this.emit('error', new Error('Connection is not open. You should listen for the `open` event before sending messages.'));
    return;
  }
  if (this._reliable) {
    // Note: reliable shim sending will make it so that you cannot customize
    // serialization.
    this._reliable.send(data);
    return;
  }
  var self = this;
  if (this.serialization === 'json') {
    this._bufferedSend(JSON.stringify(data));
  } else if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
    var blob = util.pack(data);

    // For Chrome-Firefox interoperability, we need to make Firefox "chunk"
    // the data it sends out.
    var needsChunking = util.chunkedBrowsers[this._peerBrowser] || util.chunkedBrowsers[util.browser];
    if (needsChunking && !chunked && blob.size > util.chunkedMTU) {
      this._sendChunks(blob);
      return;
    }

    // DataChannel currently only supports strings.
    if (!util.supports.sctp) {
      util.blobToBinaryString(blob, function(str) {
        self._bufferedSend(str);
      });
    } else if (!util.supports.binaryBlob) {
      // We only do this if we really need to (e.g. blobs are not supported),
      // because this conversion is costly.
      util.blobToArrayBuffer(blob, function(ab) {
        self._bufferedSend(ab);
      });
    } else {
      this._bufferedSend(blob);
    }
  } else {
    this._bufferedSend(data);
  }
}

DataConnection.prototype._bufferedSend = function(msg) {
  if (this._buffering || !this._trySend(msg)) {
    this._buffer.push(msg);
    this.bufferSize = this._buffer.length;
  }
}

// Returns true if the send succeeds.
DataConnection.prototype._trySend = function(msg) {
  try {
    this._dc.send(msg);
  } catch (e) {
    this._buffering = true;

    var self = this;
    setTimeout(function() {
      // Try again.
      self._buffering = false;
      self._tryBuffer();
    }, 100);
    return false;
  }
  return true;
}

// Try to send the first message in the buffer.
DataConnection.prototype._tryBuffer = function() {
  if (this._buffer.length === 0) {
    return;
  }

  var msg = this._buffer[0];

  if (this._trySend(msg)) {
    this._buffer.shift();
    this.bufferSize = this._buffer.length;
    this._tryBuffer();
  }
}

DataConnection.prototype._sendChunks = function(blob) {
  var blobs = util.chunk(blob);
  for (var i = 0, ii = blobs.length; i < ii; i += 1) {
    var blob = blobs[i];
    this.send(blob, true);
  }
}

DataConnection.prototype.handleMessage = function(message) {
  var payload = message.payload;

  switch (message.type) {
    case 'ANSWER':
      this._peerBrowser = payload.browser;

      // Forward to negotiator
      Negotiator.handleSDP(message.type, this, payload.sdp);
      break;
    case 'CANDIDATE':
      Negotiator.handleCandidate(this, payload.candidate);
      break;
    default:
      util.warn('Unrecognized message type:', message.type, 'from peer:', this.peer);
      break;
  }
}

module.exports = DataConnection;

},{"./negotiator":6,"./util":9,"eventemitter3":10,"reliable":11}],5:[function(require,module,exports){
var util = require('./util');
var EventEmitter = require('eventemitter3');
var Negotiator = require('./negotiator');

/**
 * Wraps the streaming interface between two Peers.
 */
function MediaConnection(peer, provider, options) {
  if (!(this instanceof MediaConnection)) return new MediaConnection(peer, provider, options);
  EventEmitter.call(this);

  this.options = util.extend({}, options);

  this.open = false;
  this.type = 'media';
  this.peer = peer;
  this.provider = provider;
  this.metadata = this.options.metadata;
  this.localStream = this.options._stream;

  this.id = this.options.connectionId || MediaConnection._idPrefix + util.randomToken();
  if (this.localStream) {
    Negotiator.startConnection(
      this,
      {_stream: this.localStream, originator: true}
    );
  }
};

util.inherits(MediaConnection, EventEmitter);

MediaConnection._idPrefix = 'mc_';

MediaConnection.prototype.addStream = function(remoteStream) {
  util.log('Receiving stream', remoteStream);

  this.remoteStream = remoteStream;
  this.emit('stream', remoteStream); // Should we call this `open`?

};

MediaConnection.prototype.handleMessage = function(message) {
  var payload = message.payload;

  switch (message.type) {
    case 'ANSWER':
      // Forward to negotiator
      Negotiator.handleSDP(message.type, this, payload.sdp);
      this.open = true;
      break;
    case 'CANDIDATE':
      Negotiator.handleCandidate(this, payload.candidate);
      break;
    default:
      util.warn('Unrecognized message type:', message.type, 'from peer:', this.peer);
      break;
  }
}

MediaConnection.prototype.answer = function(stream) {
  if (this.localStream) {
    util.warn('Local stream already exists on this MediaConnection. Are you answering a call twice?');
    return;
  }

  this.options._payload._stream = stream;

  this.localStream = stream;
  Negotiator.startConnection(
    this,
    this.options._payload
  )
  // Retrieve lost messages stored because PeerConnection not set up.
  var messages = this.provider._getMessages(this.id);
  for (var i = 0, ii = messages.length; i < ii; i += 1) {
    this.handleMessage(messages[i]);
  }
  this.open = true;
};

/**
 * Exposed functionality for users.
 */

/** Allows user to close connection. */
MediaConnection.prototype.close = function() {
  if (!this.open) {
    return;
  }
  this.open = false;
  Negotiator.cleanup(this);
  this.emit('close')
};

module.exports = MediaConnection;

},{"./negotiator":6,"./util":9,"eventemitter3":10}],6:[function(require,module,exports){
var util = require('./util');
var RTCPeerConnection = require('./adapter').RTCPeerConnection;
var RTCSessionDescription = require('./adapter').RTCSessionDescription;
var RTCIceCandidate = require('./adapter').RTCIceCandidate;

/**
 * Manages all negotiations between Peers.
 */
var Negotiator = {
  pcs: {
    data: {},
    media: {}
  }, // type => {peerId: {pc_id: pc}}.
  //providers: {}, // provider's id => providers (there may be multiple providers/client.
  queue: [] // connections that are delayed due to a PC being in use.
}

Negotiator._idPrefix = 'pc_';

/** Returns a PeerConnection object set up correctly (for data, media). */
Negotiator.startConnection = function(connection, options) {
  var pc = Negotiator._getPeerConnection(connection, options);

  if (connection.type === 'media' && options._stream) {
    // Add the stream.
    pc.addStream(options._stream);
  }

  // Set the connection's PC.
  connection.pc = connection.peerConnection = pc;
  // What do we need to do now?
  if (options.originator) {
    if (connection.type === 'data') {
      // Create the datachannel.
      var config = {};
      // Dropping reliable:false support, since it seems to be crashing
      // Chrome.
      /*if (util.supports.sctp && !options.reliable) {
        // If we have canonical reliable support...
        config = {maxRetransmits: 0};
      }*/
      // Fallback to ensure older browsers don't crash.
      if (!util.supports.sctp) {
        config = {reliable: options.reliable};
      }
      var dc = pc.createDataChannel(connection.label, config);
      connection.initialize(dc);
    }

    if (!util.supports.onnegotiationneeded) {
      Negotiator._makeOffer(connection);
    }
  } else {
    Negotiator.handleSDP('OFFER', connection, options.sdp);
  }
}

Negotiator._getPeerConnection = function(connection, options) {
  if (!Negotiator.pcs[connection.type]) {
    util.error(connection.type + ' is not a valid connection type. Maybe you overrode the `type` property somewhere.');
  }

  if (!Negotiator.pcs[connection.type][connection.peer]) {
    Negotiator.pcs[connection.type][connection.peer] = {};
  }
  var peerConnections = Negotiator.pcs[connection.type][connection.peer];

  var pc;
  // Not multiplexing while FF and Chrome have not-great support for it.
  /*if (options.multiplex) {
    ids = Object.keys(peerConnections);
    for (var i = 0, ii = ids.length; i < ii; i += 1) {
      pc = peerConnections[ids[i]];
      if (pc.signalingState === 'stable') {
        break; // We can go ahead and use this PC.
      }
    }
  } else */
  if (options.pc) { // Simplest case: PC id already provided for us.
    pc = Negotiator.pcs[connection.type][connection.peer][options.pc];
  }

  if (!pc || pc.signalingState !== 'stable') {
    pc = Negotiator._startPeerConnection(connection);
  }
  return pc;
}

/*
Negotiator._addProvider = function(provider) {
  if ((!provider.id && !provider.disconnected) || !provider.socket.open) {
    // Wait for provider to obtain an ID.
    provider.on('open', function(id) {
      Negotiator._addProvider(provider);
    });
  } else {
    Negotiator.providers[provider.id] = provider;
  }
}*/


/** Start a PC. */
Negotiator._startPeerConnection = function(connection) {
  util.log('Creating RTCPeerConnection.');

  var id = Negotiator._idPrefix + util.randomToken();
  var optional = {};

  if (connection.type === 'data' && !util.supports.sctp) {
    optional = {optional: [{RtpDataChannels: true}]};
  } else if (connection.type === 'media') {
    // Interop req for chrome.
    optional = {optional: [{DtlsSrtpKeyAgreement: true}]};
  }

  var pc = new RTCPeerConnection(connection.provider.options.config, optional);
  Negotiator.pcs[connection.type][connection.peer][id] = pc;

  Negotiator._setupListeners(connection, pc, id);

  return pc;
}

/** Set up various WebRTC listeners. */
Negotiator._setupListeners = function(connection, pc, pc_id) {
  var peerId = connection.peer;
  var connectionId = connection.id;
  var provider = connection.provider;

  // ICE CANDIDATES.
  util.log('Listening for ICE candidates.');
  pc.onicecandidate = function(evt) {
    if (evt.candidate) {
      util.log('Received ICE candidates for:', connection.peer);
      provider.socket.send({
        type: 'CANDIDATE',
        payload: {
          candidate: evt.candidate,
          type: connection.type,
          connectionId: connection.id
        },
        dst: peerId
      });
    }
  };

  pc.oniceconnectionstatechange = function() {
    switch (pc.iceConnectionState) {
      case 'disconnected':
      case 'failed':
        util.log('iceConnectionState is disconnected, closing connections to ' + peerId);
        connection.close();
        break;
      case 'completed':
        pc.onicecandidate = util.noop;
        break;
    }
  };

  // Fallback for older Chrome impls.
  pc.onicechange = pc.oniceconnectionstatechange;

  // ONNEGOTIATIONNEEDED (Chrome)
  util.log('Listening for `negotiationneeded`');
  pc.onnegotiationneeded = function() {
    util.log('`negotiationneeded` triggered');
    if (pc.signalingState == 'stable') {
      Negotiator._makeOffer(connection);
    } else {
      util.log('onnegotiationneeded triggered when not stable. Is another connection being established?');
    }
  };

  // DATACONNECTION.
  util.log('Listening for data channel');
  // Fired between offer and answer, so options should already be saved
  // in the options hash.
  pc.ondatachannel = function(evt) {
    util.log('Received data channel');
    var dc = evt.channel;
    var connection = provider.getConnection(peerId, connectionId);
    connection.initialize(dc);
  };

  // MEDIACONNECTION.
  util.log('Listening for remote stream');
  pc.onaddstream = function(evt) {
    util.log('Received remote stream');
    var stream = evt.stream;
    var connection = provider.getConnection(peerId, connectionId);
    // 10/10/2014: looks like in Chrome 38, onaddstream is triggered after
    // setting the remote description. Our connection object in these cases
    // is actually a DATA connection, so addStream fails.
    // TODO: This is hopefully just a temporary fix. We should try to
    // understand why this is happening.
    if (connection.type === 'media') {
      connection.addStream(stream);
    }
  };
}

Negotiator.cleanup = function(connection) {
  util.log('Cleaning up PeerConnection to ' + connection.peer);

  var pc = connection.pc;

  if (!!pc && (pc.readyState !== 'closed' || pc.signalingState !== 'closed')) {
    pc.close();
    connection.pc = null;
  }
}

Negotiator._makeOffer = function(connection) {
  var pc = connection.pc;
  pc.createOffer(function(offer) {
    util.log('Created offer.');

    if (!util.supports.sctp && connection.type === 'data' && connection.reliable) {
      offer.sdp = Reliable.higherBandwidthSDP(offer.sdp);
    }

    pc.setLocalDescription(offer, function() {
      util.log('Set localDescription: offer', 'for:', connection.peer);
      connection.provider.socket.send({
        type: 'OFFER',
        payload: {
          sdp: offer,
          type: connection.type,
          label: connection.label,
          connectionId: connection.id,
          reliable: connection.reliable,
          serialization: connection.serialization,
          metadata: connection.metadata,
          browser: util.browser
        },
        dst: connection.peer
      });
    }, function(err) {
      connection.provider.emitError('webrtc', err);
      util.log('Failed to setLocalDescription, ', err);
    });
  }, function(err) {
    connection.provider.emitError('webrtc', err);
    util.log('Failed to createOffer, ', err);
  }, connection.options.constraints);
}

Negotiator._makeAnswer = function(connection) {
  var pc = connection.pc;

  pc.createAnswer(function(answer) {
    util.log('Created answer.');

    if (!util.supports.sctp && connection.type === 'data' && connection.reliable) {
      answer.sdp = Reliable.higherBandwidthSDP(answer.sdp);
    }

    pc.setLocalDescription(answer, function() {
      util.log('Set localDescription: answer', 'for:', connection.peer);
      connection.provider.socket.send({
        type: 'ANSWER',
        payload: {
          sdp: answer,
          type: connection.type,
          connectionId: connection.id,
          browser: util.browser
        },
        dst: connection.peer
      });
    }, function(err) {
      connection.provider.emitError('webrtc', err);
      util.log('Failed to setLocalDescription, ', err);
    });
  }, function(err) {
    connection.provider.emitError('webrtc', err);
    util.log('Failed to create answer, ', err);
  });
}

/** Handle an SDP. */
Negotiator.handleSDP = function(type, connection, sdp) {
  sdp = new RTCSessionDescription(sdp);
  var pc = connection.pc;

  util.log('Setting remote description', sdp);
  pc.setRemoteDescription(sdp, function() {
    util.log('Set remoteDescription:', type, 'for:', connection.peer);

    if (type === 'OFFER') {
      Negotiator._makeAnswer(connection);
    }
  }, function(err) {
    connection.provider.emitError('webrtc', err);
    util.log('Failed to setRemoteDescription, ', err);
  });
}

/** Handle a candidate. */
Negotiator.handleCandidate = function(connection, ice) {
  var candidate = ice.candidate;
  var sdpMLineIndex = ice.sdpMLineIndex;
  connection.pc.addIceCandidate(new RTCIceCandidate({
    sdpMLineIndex: sdpMLineIndex,
    candidate: candidate
  }));
  util.log('Added ICE candidate for:', connection.peer);
}

module.exports = Negotiator;

},{"./adapter":3,"./util":9}],7:[function(require,module,exports){
var util = require('./util');
var EventEmitter = require('eventemitter3');
var Socket = require('./socket');
var MediaConnection = require('./mediaconnection');
var DataConnection = require('./dataconnection');

/**
 * A peer who can initiate connections with other peers.
 */
function Peer(id, options) {
  if (!(this instanceof Peer)) return new Peer(id, options);
  EventEmitter.call(this);

  // Deal with overloading
  if (id && id.constructor == Object) {
    options = id;
    id = undefined;
  } else if (id) {
    // Ensure id is a string
    id = id.toString();
  }
  //

  // Configurize options
  options = util.extend({
    debug: 0, // 1: Errors, 2: Warnings, 3: All logs
    host: util.CLOUD_HOST,
    port: util.CLOUD_PORT,
    key: 'peerjs',
    path: '/',
    token: util.randomToken(),
    config: util.defaultConfig
  }, options);
  this.options = options;
  // Detect relative URL host.
  if (options.host === '/') {
    options.host = window.location.hostname;
  }
  // Set path correctly.
  if (options.path[0] !== '/') {
    options.path = '/' + options.path;
  }
  if (options.path[options.path.length - 1] !== '/') {
    options.path += '/';
  }

  // Set whether we use SSL to same as current host
  if (options.secure === undefined && options.host !== util.CLOUD_HOST) {
    options.secure = util.isSecure();
  }
  // Set a custom log function if present
  if (options.logFunction) {
    util.setLogFunction(options.logFunction);
  }
  util.setLogLevel(options.debug);
  //

  // Sanity checks
  // Ensure WebRTC supported
  if (!util.supports.audioVideo && !util.supports.data ) {
    this._delayedAbort('browser-incompatible', 'The current browser does not support WebRTC');
    return;
  }
  // Ensure alphanumeric id
  if (!util.validateId(id)) {
    this._delayedAbort('invalid-id', 'ID "' + id + '" is invalid');
    return;
  }
  // Ensure valid key
  if (!util.validateKey(options.key)) {
    this._delayedAbort('invalid-key', 'API KEY "' + options.key + '" is invalid');
    return;
  }
  // Ensure not using unsecure cloud server on SSL page
  if (options.secure && options.host === '0.peerjs.com') {
    this._delayedAbort('ssl-unavailable',
      'The cloud server currently does not support HTTPS. Please run your own PeerServer to use HTTPS.');
    return;
  }
  //

  // States.
  this.destroyed = false; // Connections have been killed
  this.disconnected = false; // Connection to PeerServer killed but P2P connections still active
  this.open = false; // Sockets and such are not yet open.
  //

  // References
  this.connections = {}; // DataConnections for this peer.
  this._lostMessages = {}; // src => [list of messages]
  //

  // Start the server connection
  this._initializeServerConnection();
  if (id) {
    this._initialize(id);
  } else {
    this._retrieveId();
  }
  //
}

util.inherits(Peer, EventEmitter);

// Initialize the 'socket' (which is actually a mix of XHR streaming and
// websockets.)
Peer.prototype._initializeServerConnection = function() {
  var self = this;
  this.socket = new Socket(this.options.secure, this.options.host, this.options.port, this.options.path, this.options.key);
  this.socket.on('message', function(data) {
    self._handleMessage(data);
  });
  this.socket.on('error', function(error) {
    self._abort('socket-error', error);
  });
  this.socket.on('disconnected', function() {
    // If we haven't explicitly disconnected, emit error and disconnect.
    if (!self.disconnected) {
      self.emitError('network', 'Lost connection to server.');
      self.disconnect();
    }
  });
  this.socket.on('close', function() {
    // If we haven't explicitly disconnected, emit error.
    if (!self.disconnected) {
      self._abort('socket-closed', 'Underlying socket is already closed.');
    }
  });
};

/** Get a unique ID from the server via XHR. */
Peer.prototype._retrieveId = function(cb) {
  var self = this;
  var http = new XMLHttpRequest();
  var protocol = this.options.secure ? 'https://' : 'http://';
  var url = protocol + this.options.host + ':' + this.options.port +
    this.options.path + this.options.key + '/id';
  var queryString = '?ts=' + new Date().getTime() + '' + Math.random();
  url += queryString;

  // If there's no ID we need to wait for one before trying to init socket.
  http.open('get', url, true);
  http.onerror = function(e) {
    util.error('Error retrieving ID', e);
    var pathError = '';
    if (self.options.path === '/' && self.options.host !== util.CLOUD_HOST) {
      pathError = ' If you passed in a `path` to your self-hosted PeerServer, ' +
        'you\'ll also need to pass in that same path when creating a new ' +
        'Peer.';
    }
    self._abort('server-error', 'Could not get an ID from the server.' + pathError);
  };
  http.onreadystatechange = function() {
    if (http.readyState !== 4) {
      return;
    }
    if (http.status !== 200) {
      http.onerror();
      return;
    }
    self._initialize(http.responseText);
  };
  http.send(null);
};

/** Initialize a connection with the server. */
Peer.prototype._initialize = function(id) {
  this.id = id;
  this.socket.start(this.id, this.options.token);
};

/** Handles messages from the server. */
Peer.prototype._handleMessage = function(message) {
  var type = message.type;
  var payload = message.payload;
  var peer = message.src;
  var connection;

  switch (type) {
    case 'OPEN': // The connection to the server is open.
      this.emit('open', this.id);
      this.open = true;
      break;
    case 'ERROR': // Server error.
      this._abort('server-error', payload.msg);
      break;
    case 'ID-TAKEN': // The selected ID is taken.
      this._abort('unavailable-id', 'ID `' + this.id + '` is taken');
      break;
    case 'INVALID-KEY': // The given API key cannot be found.
      this._abort('invalid-key', 'API KEY "' + this.options.key + '" is invalid');
      break;

    //
    case 'LEAVE': // Another peer has closed its connection to this peer.
      util.log('Received leave message from', peer);
      this._cleanupPeer(peer);
      break;

    case 'EXPIRE': // The offer sent to a peer has expired without response.
      this.emitError('peer-unavailable', 'Could not connect to peer ' + peer);
      break;
    case 'OFFER': // we should consider switching this to CALL/CONNECT, but this is the least breaking option.
      var connectionId = payload.connectionId;
      connection = this.getConnection(peer, connectionId);

      if (connection) {
        util.warn('Offer received for existing Connection ID:', connectionId);
        //connection.handleMessage(message);
      } else {
        // Create a new connection.
        if (payload.type === 'media') {
          connection = new MediaConnection(peer, this, {
            connectionId: connectionId,
            _payload: payload,
            metadata: payload.metadata
          });
          this._addConnection(peer, connection);
          this.emit('call', connection);
        } else if (payload.type === 'data') {
          connection = new DataConnection(peer, this, {
            connectionId: connectionId,
            _payload: payload,
            metadata: payload.metadata,
            label: payload.label,
            serialization: payload.serialization,
            reliable: payload.reliable
          });
          this._addConnection(peer, connection);
          this.emit('connection', connection);
        } else {
          util.warn('Received malformed connection type:', payload.type);
          return;
        }
        // Find messages.
        var messages = this._getMessages(connectionId);
        for (var i = 0, ii = messages.length; i < ii; i += 1) {
          connection.handleMessage(messages[i]);
        }
      }
      break;
    default:
      if (!payload) {
        util.warn('You received a malformed message from ' + peer + ' of type ' + type);
        return;
      }

      var id = payload.connectionId;
      connection = this.getConnection(peer, id);

      if (connection && connection.pc) {
        // Pass it on.
        connection.handleMessage(message);
      } else if (id) {
        // Store for possible later use
        this._storeMessage(id, message);
      } else {
        util.warn('You received an unrecognized message:', message);
      }
      break;
  }
};

/** Stores messages without a set up connection, to be claimed later. */
Peer.prototype._storeMessage = function(connectionId, message) {
  if (!this._lostMessages[connectionId]) {
    this._lostMessages[connectionId] = [];
  }
  this._lostMessages[connectionId].push(message);
};

/** Retrieve messages from lost message store */
Peer.prototype._getMessages = function(connectionId) {
  var messages = this._lostMessages[connectionId];
  if (messages) {
    delete this._lostMessages[connectionId];
    return messages;
  } else {
    return [];
  }
};

/**
 * Returns a DataConnection to the specified peer. See documentation for a
 * complete list of options.
 */
Peer.prototype.connect = function(peer, options) {
  if (this.disconnected) {
    util.warn('You cannot connect to a new Peer because you called ' +
      '.disconnect() on this Peer and ended your connection with the ' +
      'server. You can create a new Peer to reconnect, or call reconnect ' +
      'on this peer if you believe its ID to still be available.');
    this.emitError('disconnected', 'Cannot connect to new Peer after disconnecting from server.');
    return;
  }
  var connection = new DataConnection(peer, this, options);
  this._addConnection(peer, connection);
  return connection;
};

/**
 * Returns a MediaConnection to the specified peer. See documentation for a
 * complete list of options.
 */
Peer.prototype.call = function(peer, stream, options) {
  if (this.disconnected) {
    util.warn('You cannot connect to a new Peer because you called ' +
      '.disconnect() on this Peer and ended your connection with the ' +
      'server. You can create a new Peer to reconnect.');
    this.emitError('disconnected', 'Cannot connect to new Peer after disconnecting from server.');
    return;
  }
  if (!stream) {
    util.error('To call a peer, you must provide a stream from your browser\'s `getUserMedia`.');
    return;
  }
  options = options || {};
  options._stream = stream;
  var call = new MediaConnection(peer, this, options);
  this._addConnection(peer, call);
  return call;
};

/** Add a data/media connection to this peer. */
Peer.prototype._addConnection = function(peer, connection) {
  if (!this.connections[peer]) {
    this.connections[peer] = [];
  }
  this.connections[peer].push(connection);
};

/** Retrieve a data/media connection for this peer. */
Peer.prototype.getConnection = function(peer, id) {
  var connections = this.connections[peer];
  if (!connections) {
    return null;
  }
  for (var i = 0, ii = connections.length; i < ii; i++) {
    if (connections[i].id === id) {
      return connections[i];
    }
  }
  return null;
};

Peer.prototype._delayedAbort = function(type, message) {
  var self = this;
  util.setZeroTimeout(function(){
    self._abort(type, message);
  });
};

/**
 * Destroys the Peer and emits an error message.
 * The Peer is not destroyed if it's in a disconnected state, in which case
 * it retains its disconnected state and its existing connections.
 */
Peer.prototype._abort = function(type, message) {
  util.error('Aborting!');
  if (!this._lastServerId) {
    this.destroy();
  } else {
    this.disconnect();
  }
  this.emitError(type, message);
};

/** Emits a typed error message. */
Peer.prototype.emitError = function(type, err) {
  util.error('Error:', err);
  if (typeof err === 'string') {
    err = new Error(err);
  }
  err.type = type;
  this.emit('error', err);
};

/**
 * Destroys the Peer: closes all active connections as well as the connection
 *  to the server.
 * Warning: The peer can no longer create or accept connections after being
 *  destroyed.
 */
Peer.prototype.destroy = function() {
  if (!this.destroyed) {
    this._cleanup();
    this.disconnect();
    this.destroyed = true;
  }
};


/** Disconnects every connection on this peer. */
Peer.prototype._cleanup = function() {
  if (this.connections) {
    var peers = Object.keys(this.connections);
    for (var i = 0, ii = peers.length; i < ii; i++) {
      this._cleanupPeer(peers[i]);
    }
  }
  this.emit('close');
};

/** Closes all connections to this peer. */
Peer.prototype._cleanupPeer = function(peer) {
  var connections = this.connections[peer];
  for (var j = 0, jj = connections.length; j < jj; j += 1) {
    connections[j].close();
  }
};

/**
 * Disconnects the Peer's connection to the PeerServer. Does not close any
 *  active connections.
 * Warning: The peer can no longer create or accept connections after being
 *  disconnected. It also cannot reconnect to the server.
 */
Peer.prototype.disconnect = function() {
  var self = this;
  util.setZeroTimeout(function(){
    if (!self.disconnected) {
      self.disconnected = true;
      self.open = false;
      if (self.socket) {
        self.socket.close();
      }
      self.emit('disconnected', self.id);
      self._lastServerId = self.id;
      self.id = null;
    }
  });
};

/** Attempts to reconnect with the same ID. */
Peer.prototype.reconnect = function() {
  if (this.disconnected && !this.destroyed) {
    util.log('Attempting reconnection to server with ID ' + this._lastServerId);
    this.disconnected = false;
    this._initializeServerConnection();
    this._initialize(this._lastServerId);
  } else if (this.destroyed) {
    throw new Error('This peer cannot reconnect to the server. It has already been destroyed.');
  } else if (!this.disconnected && !this.open) {
    // Do nothing. We're still connecting the first time.
    util.error('In a hurry? We\'re still trying to make the initial connection!');
  } else {
    throw new Error('Peer ' + this.id + ' cannot reconnect because it is not disconnected from the server!');
  }
};

/**
 * Get a list of available peer IDs. If you're running your own server, you'll
 * want to set allow_discovery: true in the PeerServer options. If you're using
 * the cloud server, email team@peerjs.com to get the functionality enabled for
 * your key.
 */
Peer.prototype.listAllPeers = function(cb) {
  cb = cb || function() {};
  var self = this;
  var http = new XMLHttpRequest();
  var protocol = this.options.secure ? 'https://' : 'http://';
  var url = protocol + this.options.host + ':' + this.options.port +
    this.options.path + this.options.key + '/peers';
  var queryString = '?ts=' + new Date().getTime() + '' + Math.random();
  url += queryString;

  // If there's no ID we need to wait for one before trying to init socket.
  http.open('get', url, true);
  http.onerror = function(e) {
    self._abort('server-error', 'Could not get peers from the server.');
    cb([]);
  };
  http.onreadystatechange = function() {
    if (http.readyState !== 4) {
      return;
    }
    if (http.status === 401) {
      var helpfulError = '';
      if (self.options.host !== util.CLOUD_HOST) {
        helpfulError = 'It looks like you\'re using the cloud server. You can email ' +
          'team@peerjs.com to enable peer listing for your API key.';
      } else {
        helpfulError = 'You need to enable `allow_discovery` on your self-hosted ' +
          'PeerServer to use this feature.';
      }
      cb([]);
      throw new Error('It doesn\'t look like you have permission to list peers IDs. ' + helpfulError);
    } else if (http.status !== 200) {
      cb([]);
    } else {
      cb(JSON.parse(http.responseText));
    }
  };
  http.send(null);
};

module.exports = Peer;

},{"./dataconnection":4,"./mediaconnection":5,"./socket":8,"./util":9,"eventemitter3":10}],8:[function(require,module,exports){
var util = require('./util');
var EventEmitter = require('eventemitter3');

/**
 * An abstraction on top of WebSockets and XHR streaming to provide fastest
 * possible connection for peers.
 */
function Socket(secure, host, port, path, key) {
  if (!(this instanceof Socket)) return new Socket(secure, host, port, path, key);

  EventEmitter.call(this);

  // Disconnected manually.
  this.disconnected = false;
  this._queue = [];

  var httpProtocol = secure ? 'https://' : 'http://';
  var wsProtocol = secure ? 'wss://' : 'ws://';
  this._httpUrl = httpProtocol + host + ':' + port + path + key;
  this._wsUrl = wsProtocol + host + ':' + port + path + 'peerjs?key=' + key;
}

util.inherits(Socket, EventEmitter);


/** Check in with ID or get one from server. */
Socket.prototype.start = function(id, token) {
  this.id = id;

  this._httpUrl += '/' + id + '/' + token;
  this._wsUrl += '&id=' + id + '&token=' + token;

  this._startXhrStream();
  this._startWebSocket();
}


/** Start up websocket communications. */
Socket.prototype._startWebSocket = function(id) {
  var self = this;

  if (this._socket) {
    return;
  }

  this._socket = new WebSocket(this._wsUrl);

  this._socket.onmessage = function(event) {
    try {
      var data = JSON.parse(event.data);
    } catch(e) {
      util.log('Invalid server message', event.data);
      return;
    }
    self.emit('message', data);
  };

  this._socket.onclose = function(event) {
    util.log('Socket closed.');
    self.disconnected = true;
    self.emit('disconnected');
  };

  // Take care of the queue of connections if necessary and make sure Peer knows
  // socket is open.
  this._socket.onopen = function() {
    if (self._timeout) {
      clearTimeout(self._timeout);
      setTimeout(function(){
        self._http.abort();
        self._http = null;
      }, 5000);
    }
    self._sendQueuedMessages();
    util.log('Socket open');
  };
}

/** Start XHR streaming. */
Socket.prototype._startXhrStream = function(n) {
  try {
    var self = this;
    this._http = new XMLHttpRequest();
    this._http._index = 1;
    this._http._streamIndex = n || 0;
    this._http.open('post', this._httpUrl + '/id?i=' + this._http._streamIndex, true);
    this._http.onerror = function() {
      // If we get an error, likely something went wrong.
      // Stop streaming.
      clearTimeout(self._timeout);
      self.emit('disconnected');
    }
    this._http.onreadystatechange = function() {
      if (this.readyState == 2 && this.old) {
        this.old.abort();
        delete this.old;
      } else if (this.readyState > 2 && this.status === 200 && this.responseText) {
        self._handleStream(this);
      }
    };
    this._http.send(null);
    this._setHTTPTimeout();
  } catch(e) {
    util.log('XMLHttpRequest not available; defaulting to WebSockets');
  }
}


/** Handles onreadystatechange response as a stream. */
Socket.prototype._handleStream = function(http) {
  // 3 and 4 are loading/done state. All others are not relevant.
  var messages = http.responseText.split('\n');

  // Check to see if anything needs to be processed on buffer.
  if (http._buffer) {
    while (http._buffer.length > 0) {
      var index = http._buffer.shift();
      var bufferedMessage = messages[index];
      try {
        bufferedMessage = JSON.parse(bufferedMessage);
      } catch(e) {
        http._buffer.shift(index);
        break;
      }
      this.emit('message', bufferedMessage);
    }
  }

  var message = messages[http._index];
  if (message) {
    http._index += 1;
    // Buffering--this message is incomplete and we'll get to it next time.
    // This checks if the httpResponse ended in a `\n`, in which case the last
    // element of messages should be the empty string.
    if (http._index === messages.length) {
      if (!http._buffer) {
        http._buffer = [];
      }
      http._buffer.push(http._index - 1);
    } else {
      try {
        message = JSON.parse(message);
      } catch(e) {
        util.log('Invalid server message', message);
        return;
      }
      this.emit('message', message);
    }
  }
}

Socket.prototype._setHTTPTimeout = function() {
  var self = this;
  this._timeout = setTimeout(function() {
    var old = self._http;
    if (!self._wsOpen()) {
      self._startXhrStream(old._streamIndex + 1);
      self._http.old = old;
    } else {
      old.abort();
    }
  }, 25000);
}

/** Is the websocket currently open? */
Socket.prototype._wsOpen = function() {
  return this._socket && this._socket.readyState == 1;
}

/** Send queued messages. */
Socket.prototype._sendQueuedMessages = function() {
  for (var i = 0, ii = this._queue.length; i < ii; i += 1) {
    this.send(this._queue[i]);
  }
}

/** Exposed send for DC & Peer. */
Socket.prototype.send = function(data) {
  if (this.disconnected) {
    return;
  }

  // If we didn't get an ID yet, we can't yet send anything so we should queue
  // up these messages.
  if (!this.id) {
    this._queue.push(data);
    return;
  }

  if (!data.type) {
    this.emit('error', 'Invalid message');
    return;
  }

  var message = JSON.stringify(data);
  if (this._wsOpen()) {
    this._socket.send(message);
  } else {
    var http = new XMLHttpRequest();
    var url = this._httpUrl + '/' + data.type.toLowerCase();
    http.open('post', url, true);
    http.setRequestHeader('Content-Type', 'application/json');
    http.send(message);
  }
}

Socket.prototype.close = function() {
  if (!this.disconnected && this._wsOpen()) {
    this._socket.close();
    this.disconnected = true;
  }
}

module.exports = Socket;

},{"./util":9,"eventemitter3":10}],9:[function(require,module,exports){
var defaultConfig = {'iceServers': [{ 'url': 'stun:stun.l.google.com:19302' }]};
var dataCount = 1;

var BinaryPack = require('js-binarypack');
var RTCPeerConnection = require('./adapter').RTCPeerConnection;

var util = {
  noop: function() {},

  CLOUD_HOST: '0.peerjs.com',
  CLOUD_PORT: 9000,

  // Browsers that need chunking:
  chunkedBrowsers: {'Chrome': 1},
  chunkedMTU: 16300, // The original 60000 bytes setting does not work when sending data from Firefox to Chrome, which is "cut off" after 16384 bytes and delivered individually.

  // Logging logic
  logLevel: 0,
  setLogLevel: function(level) {
    var debugLevel = parseInt(level, 10);
    if (!isNaN(parseInt(level, 10))) {
      util.logLevel = debugLevel;
    } else {
      // If they are using truthy/falsy values for debug
      util.logLevel = level ? 3 : 0;
    }
    util.log = util.warn = util.error = util.noop;
    if (util.logLevel > 0) {
      util.error = util._printWith('ERROR');
    }
    if (util.logLevel > 1) {
      util.warn = util._printWith('WARNING');
    }
    if (util.logLevel > 2) {
      util.log = util._print;
    }
  },
  setLogFunction: function(fn) {
    if (fn.constructor !== Function) {
      util.warn('The log function you passed in is not a function. Defaulting to regular logs.');
    } else {
      util._print = fn;
    }
  },

  _printWith: function(prefix) {
    return function() {
      var copy = Array.prototype.slice.call(arguments);
      copy.unshift(prefix);
      util._print.apply(util, copy);
    };
  },
  _print: function () {
    var err = false;
    var copy = Array.prototype.slice.call(arguments);
    copy.unshift('PeerJS: ');
    for (var i = 0, l = copy.length; i < l; i++){
      if (copy[i] instanceof Error) {
        copy[i] = '(' + copy[i].name + ') ' + copy[i].message;
        err = true;
      }
    }
    err ? console.error.apply(console, copy) : console.log.apply(console, copy);
  },
  //

  // Returns browser-agnostic default config
  defaultConfig: defaultConfig,
  //

  // Returns the current browser.
  browser: (function() {
    if (window.mozRTCPeerConnection) {
      return 'Firefox';
    } else if (window.webkitRTCPeerConnection) {
      return 'Chrome';
    } else if (window.RTCPeerConnection) {
      return 'Supported';
    } else {
      return 'Unsupported';
    }
  })(),
  //

  // Lists which features are supported
  supports: (function() {
    if (typeof RTCPeerConnection === 'undefined') {
      return {};
    }

    var data = true;
    var audioVideo = true;

    var binaryBlob = false;
    var sctp = false;
    var onnegotiationneeded = !!window.webkitRTCPeerConnection;

    var pc, dc;
    try {
      pc = new RTCPeerConnection(defaultConfig, {optional: [{RtpDataChannels: true}]});
    } catch (e) {
      data = false;
      audioVideo = false;
    }

    if (data) {
      try {
        dc = pc.createDataChannel('_PEERJSTEST');
      } catch (e) {
        data = false;
      }
    }

    if (data) {
      // Binary test
      try {
        dc.binaryType = 'blob';
        binaryBlob = true;
      } catch (e) {
      }

      // Reliable test.
      // Unfortunately Chrome is a bit unreliable about whether or not they
      // support reliable.
      var reliablePC = new RTCPeerConnection(defaultConfig, {});
      try {
        var reliableDC = reliablePC.createDataChannel('_PEERJSRELIABLETEST', {});
        sctp = reliableDC.reliable;
      } catch (e) {
      }
      reliablePC.close();
    }

    // FIXME: not really the best check...
    if (audioVideo) {
      audioVideo = !!pc.addStream;
    }

    // FIXME: this is not great because in theory it doesn't work for
    // av-only browsers (?).
    if (!onnegotiationneeded && data) {
      // sync default check.
      var negotiationPC = new RTCPeerConnection(defaultConfig, {optional: [{RtpDataChannels: true}]});
      negotiationPC.onnegotiationneeded = function() {
        onnegotiationneeded = true;
        // async check.
        if (util && util.supports) {
          util.supports.onnegotiationneeded = true;
        }
      };
      negotiationPC.createDataChannel('_PEERJSNEGOTIATIONTEST');

      setTimeout(function() {
        negotiationPC.close();
      }, 1000);
    }

    if (pc) {
      pc.close();
    }

    return {
      audioVideo: audioVideo,
      data: data,
      binaryBlob: binaryBlob,
      binary: sctp, // deprecated; sctp implies binary support.
      reliable: sctp, // deprecated; sctp implies reliable data.
      sctp: sctp,
      onnegotiationneeded: onnegotiationneeded
    };
  }()),
  //

  // Ensure alphanumeric ids
  validateId: function(id) {
    // Allow empty ids
    return !id || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.exec(id);
  },

  validateKey: function(key) {
    // Allow empty keys
    return !key || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.exec(key);
  },


  debug: false,

  inherits: function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  },
  extend: function(dest, source) {
    for(var key in source) {
      if(source.hasOwnProperty(key)) {
        dest[key] = source[key];
      }
    }
    return dest;
  },
  pack: BinaryPack.pack,
  unpack: BinaryPack.unpack,

  log: function () {
    if (util.debug) {
      var err = false;
      var copy = Array.prototype.slice.call(arguments);
      copy.unshift('PeerJS: ');
      for (var i = 0, l = copy.length; i < l; i++){
        if (copy[i] instanceof Error) {
          copy[i] = '(' + copy[i].name + ') ' + copy[i].message;
          err = true;
        }
      }
      err ? console.error.apply(console, copy) : console.log.apply(console, copy);
    }
  },

  setZeroTimeout: (function(global) {
    var timeouts = [];
    var messageName = 'zero-timeout-message';

    // Like setTimeout, but only takes a function argument.	 There's
    // no time argument (always zero) and no arguments (you have to
    // use a closure).
    function setZeroTimeoutPostMessage(fn) {
      timeouts.push(fn);
      global.postMessage(messageName, '*');
    }

    function handleMessage(event) {
      if (event.source == global && event.data == messageName) {
        if (event.stopPropagation) {
          event.stopPropagation();
        }
        if (timeouts.length) {
          timeouts.shift()();
        }
      }
    }
    if (global.addEventListener) {
      global.addEventListener('message', handleMessage, true);
    } else if (global.attachEvent) {
      global.attachEvent('onmessage', handleMessage);
    }
    return setZeroTimeoutPostMessage;
  }(window)),

  // Binary stuff

  // chunks a blob.
  chunk: function(bl) {
    var chunks = [];
    var size = bl.size;
    var start = index = 0;
    var total = Math.ceil(size / util.chunkedMTU);
    while (start < size) {
      var end = Math.min(size, start + util.chunkedMTU);
      var b = bl.slice(start, end);

      var chunk = {
        __peerData: dataCount,
        n: index,
        data: b,
        total: total
      };

      chunks.push(chunk);

      start = end;
      index += 1;
    }
    dataCount += 1;
    return chunks;
  },

  blobToArrayBuffer: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsArrayBuffer(blob);
  },
  blobToBinaryString: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsBinaryString(blob);
  },
  binaryStringToArrayBuffer: function(binary) {
    var byteArray = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      byteArray[i] = binary.charCodeAt(i) & 0xff;
    }
    return byteArray.buffer;
  },
  randomToken: function () {
    return Math.random().toString(36).substr(2);
  },
  //

  isSecure: function() {
    return location.protocol === 'https:';
  }
};

module.exports = util;

},{"./adapter":3,"js-binarypack":1}],10:[function(require,module,exports){
'use strict';

/**
 * Representation of a single EventEmitter function.
 *
 * @param {Function} fn Event handler to be called.
 * @param {Mixed} context Context for function execution.
 * @param {Boolean} once Only emit once
 * @api private
 */
function EE(fn, context, once) {
  this.fn = fn;
  this.context = context;
  this.once = once || false;
}

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() { /* Nothing to set */ }

/**
 * Holds the assigned EventEmitters by name.
 *
 * @type {Object}
 * @private
 */
EventEmitter.prototype._events = undefined;

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @returns {Array}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  if (!this._events || !this._events[event]) return [];
  if (this._events[event].fn) return [this._events[event].fn];

  for (var i = 0, l = this._events[event].length, ee = new Array(l); i < l; i++) {
    ee[i] = this._events[event][i].fn;
  }

  return ee;
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  if (!this._events || !this._events[event]) return false;

  var listeners = this._events[event]
    , len = arguments.length
    , args
    , i;

  if ('function' === typeof listeners.fn) {
    if (listeners.once) this.removeListener(event, listeners.fn, true);

    switch (len) {
      case 1: return listeners.fn.call(listeners.context), true;
      case 2: return listeners.fn.call(listeners.context, a1), true;
      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
    }

    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    listeners.fn.apply(listeners.context, args);
  } else {
    var length = listeners.length
      , j;

    for (i = 0; i < length; i++) {
      if (listeners[i].once) this.removeListener(event, listeners[i].fn, true);

      switch (len) {
        case 1: listeners[i].fn.call(listeners[i].context); break;
        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
        default:
          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
            args[j - 1] = arguments[j];
          }

          listeners[i].fn.apply(listeners[i].context, args);
      }
    }
  }

  return true;
};

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  var listener = new EE(fn, context || this);

  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = listener;
  else {
    if (!this._events[event].fn) this._events[event].push(listener);
    else this._events[event] = [
      this._events[event], listener
    ];
  }

  return this;
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  var listener = new EE(fn, context || this, true);

  if (!this._events) this._events = {};
  if (!this._events[event]) this._events[event] = listener;
  else {
    if (!this._events[event].fn) this._events[event].push(listener);
    else this._events[event] = [
      this._events[event], listener
    ];
  }

  return this;
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @param {Boolean} once Only remove once listeners.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn, once) {
  if (!this._events || !this._events[event]) return this;

  var listeners = this._events[event]
    , events = [];

  if (fn) {
    if (listeners.fn && (listeners.fn !== fn || (once && !listeners.once))) {
      events.push(listeners);
    }
    if (!listeners.fn) for (var i = 0, length = listeners.length; i < length; i++) {
      if (listeners[i].fn !== fn || (once && !listeners[i].once)) {
        events.push(listeners[i]);
      }
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) {
    this._events[event] = events.length === 1 ? events[0] : events;
  } else {
    delete this._events[event];
  }

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (!this._events) return this;

  if (event) delete this._events[event];
  else this._events = {};

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// This function doesn't apply anymore.
//
EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
  return this;
};

//
// Expose the module.
//
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.EventEmitter2 = EventEmitter;
EventEmitter.EventEmitter3 = EventEmitter;

//
// Expose the module.
//
module.exports = EventEmitter;

},{}],11:[function(require,module,exports){
var util = require('./util');

/**
 * Reliable transfer for Chrome Canary DataChannel impl.
 * Author: @michellebu
 */
function Reliable(dc, debug) {
  if (!(this instanceof Reliable)) return new Reliable(dc);
  this._dc = dc;

  util.debug = debug;

  // Messages sent/received so far.
  // id: { ack: n, chunks: [...] }
  this._outgoing = {};
  // id: { ack: ['ack', id, n], chunks: [...] }
  this._incoming = {};
  this._received = {};

  // Window size.
  this._window = 1000;
  // MTU.
  this._mtu = 500;
  // Interval for setInterval. In ms.
  this._interval = 0;

  // Messages sent.
  this._count = 0;

  // Outgoing message queue.
  this._queue = [];

  this._setupDC();
};

// Send a message reliably.
Reliable.prototype.send = function(msg) {
  // Determine if chunking is necessary.
  var bl = util.pack(msg);
  if (bl.size < this._mtu) {
    this._handleSend(['no', bl]);
    return;
  }

  this._outgoing[this._count] = {
    ack: 0,
    chunks: this._chunk(bl)
  };

  if (util.debug) {
    this._outgoing[this._count].timer = new Date();
  }

  // Send prelim window.
  this._sendWindowedChunks(this._count);
  this._count += 1;
};

// Set up interval for processing queue.
Reliable.prototype._setupInterval = function() {
  // TODO: fail gracefully.

  var self = this;
  this._timeout = setInterval(function() {
    // FIXME: String stuff makes things terribly async.
    var msg = self._queue.shift();
    if (msg._multiple) {
      for (var i = 0, ii = msg.length; i < ii; i += 1) {
        self._intervalSend(msg[i]);
      }
    } else {
      self._intervalSend(msg);
    }
  }, this._interval);
};

Reliable.prototype._intervalSend = function(msg) {
  var self = this;
  msg = util.pack(msg);
  util.blobToBinaryString(msg, function(str) {
    self._dc.send(str);
  });
  if (self._queue.length === 0) {
    clearTimeout(self._timeout);
    self._timeout = null;
    //self._processAcks();
  }
};

// Go through ACKs to send missing pieces.
Reliable.prototype._processAcks = function() {
  for (var id in this._outgoing) {
    if (this._outgoing.hasOwnProperty(id)) {
      this._sendWindowedChunks(id);
    }
  }
};

// Handle sending a message.
// FIXME: Don't wait for interval time for all messages...
Reliable.prototype._handleSend = function(msg) {
  var push = true;
  for (var i = 0, ii = this._queue.length; i < ii; i += 1) {
    var item = this._queue[i];
    if (item === msg) {
      push = false;
    } else if (item._multiple && item.indexOf(msg) !== -1) {
      push = false;
    }
  }
  if (push) {
    this._queue.push(msg);
    if (!this._timeout) {
      this._setupInterval();
    }
  }
};

// Set up DataChannel handlers.
Reliable.prototype._setupDC = function() {
  // Handle various message types.
  var self = this;
  this._dc.onmessage = function(e) {
    var msg = e.data;
    var datatype = msg.constructor;
    // FIXME: msg is String until binary is supported.
    // Once that happens, this will have to be smarter.
    if (datatype === String) {
      var ab = util.binaryStringToArrayBuffer(msg);
      msg = util.unpack(ab);
      self._handleMessage(msg);
    }
  };
};

// Handles an incoming message.
Reliable.prototype._handleMessage = function(msg) {
  var id = msg[1];
  var idata = this._incoming[id];
  var odata = this._outgoing[id];
  var data;
  switch (msg[0]) {
    // No chunking was done.
    case 'no':
      var message = id;
      if (!!message) {
        this.onmessage(util.unpack(message));
      }
      break;
    // Reached the end of the message.
    case 'end':
      data = idata;

      // In case end comes first.
      this._received[id] = msg[2];

      if (!data) {
        break;
      }

      this._ack(id);
      break;
    case 'ack':
      data = odata;
      if (!!data) {
        var ack = msg[2];
        // Take the larger ACK, for out of order messages.
        data.ack = Math.max(ack, data.ack);

        // Clean up when all chunks are ACKed.
        if (data.ack >= data.chunks.length) {
          util.log('Time: ', new Date() - data.timer);
          delete this._outgoing[id];
        } else {
          this._processAcks();
        }
      }
      // If !data, just ignore.
      break;
    // Received a chunk of data.
    case 'chunk':
      // Create a new entry if none exists.
      data = idata;
      if (!data) {
        var end = this._received[id];
        if (end === true) {
          break;
        }
        data = {
          ack: ['ack', id, 0],
          chunks: []
        };
        this._incoming[id] = data;
      }

      var n = msg[2];
      var chunk = msg[3];
      data.chunks[n] = new Uint8Array(chunk);

      // If we get the chunk we're looking for, ACK for next missing.
      // Otherwise, ACK the same N again.
      if (n === data.ack[2]) {
        this._calculateNextAck(id);
      }
      this._ack(id);
      break;
    default:
      // Shouldn't happen, but would make sense for message to just go
      // through as is.
      this._handleSend(msg);
      break;
  }
};

// Chunks BL into smaller messages.
Reliable.prototype._chunk = function(bl) {
  var chunks = [];
  var size = bl.size;
  var start = 0;
  while (start < size) {
    var end = Math.min(size, start + this._mtu);
    var b = bl.slice(start, end);
    var chunk = {
      payload: b
    }
    chunks.push(chunk);
    start = end;
  }
  util.log('Created', chunks.length, 'chunks.');
  return chunks;
};

// Sends ACK N, expecting Nth blob chunk for message ID.
Reliable.prototype._ack = function(id) {
  var ack = this._incoming[id].ack;

  // if ack is the end value, then call _complete.
  if (this._received[id] === ack[2]) {
    this._complete(id);
    this._received[id] = true;
  }

  this._handleSend(ack);
};

// Calculates the next ACK number, given chunks.
Reliable.prototype._calculateNextAck = function(id) {
  var data = this._incoming[id];
  var chunks = data.chunks;
  for (var i = 0, ii = chunks.length; i < ii; i += 1) {
    // This chunk is missing!!! Better ACK for it.
    if (chunks[i] === undefined) {
      data.ack[2] = i;
      return;
    }
  }
  data.ack[2] = chunks.length;
};

// Sends the next window of chunks.
Reliable.prototype._sendWindowedChunks = function(id) {
  util.log('sendWindowedChunks for: ', id);
  var data = this._outgoing[id];
  var ch = data.chunks;
  var chunks = [];
  var limit = Math.min(data.ack + this._window, ch.length);
  for (var i = data.ack; i < limit; i += 1) {
    if (!ch[i].sent || i === data.ack) {
      ch[i].sent = true;
      chunks.push(['chunk', id, i, ch[i].payload]);
    }
  }
  if (data.ack + this._window >= ch.length) {
    chunks.push(['end', id, ch.length])
  }
  chunks._multiple = true;
  this._handleSend(chunks);
};

// Puts together a message from chunks.
Reliable.prototype._complete = function(id) {
  util.log('Completed called for', id);
  var self = this;
  var chunks = this._incoming[id].chunks;
  var bl = new Blob(chunks);
  util.blobToArrayBuffer(bl, function(ab) {
    self.onmessage(util.unpack(ab));
  });
  delete this._incoming[id];
};

// Ups bandwidth limit on SDP. Meant to be called during offer/answer.
Reliable.higherBandwidthSDP = function(sdp) {
  // AS stands for Application-Specific Maximum.
  // Bandwidth number is in kilobits / sec.
  // See RFC for more info: http://www.ietf.org/rfc/rfc2327.txt

  // Chrome 31+ doesn't want us munging the SDP, so we'll let them have their
  // way.
  var version = navigator.appVersion.match(/Chrome\/(.*?) /);
  if (version) {
    version = parseInt(version[1].split('.').shift());
    if (version < 31) {
      var parts = sdp.split('b=AS:30');
      var replace = 'b=AS:102400'; // 100 Mbps
      if (parts.length > 1) {
        return parts[0] + replace + parts[1];
      }
    }
  }

  return sdp;
};

// Overwritten, typically.
Reliable.prototype.onmessage = function(msg) {};

module.exports.Reliable = Reliable;

},{"./util":12}],12:[function(require,module,exports){
var BinaryPack = require('js-binarypack');

var util = {
  debug: false,
  
  inherits: function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  },
  extend: function(dest, source) {
    for(var key in source) {
      if(source.hasOwnProperty(key)) {
        dest[key] = source[key];
      }
    }
    return dest;
  },
  pack: BinaryPack.pack,
  unpack: BinaryPack.unpack,
  
  log: function () {
    if (util.debug) {
      var copy = [];
      for (var i = 0; i < arguments.length; i++) {
        copy[i] = arguments[i];
      }
      copy.unshift('Reliable: ');
      console.log.apply(console, copy);
    }
  },

  setZeroTimeout: (function(global) {
    var timeouts = [];
    var messageName = 'zero-timeout-message';

    // Like setTimeout, but only takes a function argument.	 There's
    // no time argument (always zero) and no arguments (you have to
    // use a closure).
    function setZeroTimeoutPostMessage(fn) {
      timeouts.push(fn);
      global.postMessage(messageName, '*');
    }		

    function handleMessage(event) {
      if (event.source == global && event.data == messageName) {
        if (event.stopPropagation) {
          event.stopPropagation();
        }
        if (timeouts.length) {
          timeouts.shift()();
        }
      }
    }
    if (global.addEventListener) {
      global.addEventListener('message', handleMessage, true);
    } else if (global.attachEvent) {
      global.attachEvent('onmessage', handleMessage);
    }
    return setZeroTimeoutPostMessage;
  }(this)),
  
  blobToArrayBuffer: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsArrayBuffer(blob);
  },
  blobToBinaryString: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsBinaryString(blob);
  },
  binaryStringToArrayBuffer: function(binary) {
    var byteArray = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      byteArray[i] = binary.charCodeAt(i) & 0xff;
    }
    return byteArray.buffer;
  },
  randomToken: function () {
    return Math.random().toString(36).substr(2);
  }
};

module.exports = util;

},{"js-binarypack":1}],13:[function(require,module,exports){
/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
/*global define:false, require:false, exports:false, module:false, signals:false */

/** @license
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license
 * Author: Miller Medeiros
 * Version: 1.0.0 - Build: 268 (2012/11/29 05:48 PM)
 */

(function(global){

    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {boolean} isOnce If binding should be executed just once.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority] The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * @return {Signal} Signal that listener is currently bound to.
         */
        getSignal : function () {
            return this._signal;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @name Signal
     * @author Miller Medeiros
     * @constructor
     */
    function Signal() {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;

        // enforce dispatch to aways work on same context (#47)
        var self = this;
        this.dispatch = function(){
            Signal.prototype.dispatch.apply(self, arguments);
        };
    }

    Signal.prototype = {

        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '1.0.0',

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [listenerContext]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, listenerContext, priority) {

            var prevIndex = this._indexOfListener(listener, listenerContext),
                binding;

            if (prevIndex !== -1) {
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener, context) {
            var n = this._bindings.length,
                cur;
            while (n--) {
                cur = this._bindings[n];
                if (cur._listener === listener && cur.context === context) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @param {Object} [context]
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener, context) {
            return this._indexOfListener(listener, context) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, listenerContext, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, listenerContext, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, listenerContext, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, listenerContext, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener Handler function that should be removed.
         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
         * @return {Function} Listener handler function.
         */
        remove : function (listener, context) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener, context);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params] Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                n = this._bindings.length,
                bindings;

            if (this.memorize) {
                this._prevParams = paramsArr;
            }

            if (! n) {
                //should come after memorize
                return;
            }

            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };


    // Namespace -----------------------------------------------------
    //================================================================

    /**
     * Signals namespace
     * @namespace
     * @name signals
     */
    var signals = Signal;

    /**
     * Custom event broadcaster
     * @see Signal
     */
    // alias for backwards compatibility (see #gh-44)
    signals.Signal = Signal;



    //exports to multiple environments
    if(typeof define === 'function' && define.amd){ //AMD
        define(function () { return signals; });
    } else if (typeof module !== 'undefined' && module.exports){ //node
        module.exports = signals;
    } else { //browser
        //use string because of Google closure compiler ADVANCED_MODE
        /*jslint sub:true */
        global['signals'] = signals;
    }

}(this));

},{}],14:[function(require,module,exports){
var io = require('./socket.io.js');
var Peer = require('peerjs');
var _  = require('../util');
var signals = require('signals');
var Lobby = function(ws_url,options){
    this.ws_url = ws_url;
    this._options = _.extend({
        lobbyPath:'/lobby',
        peerjsPath:'/peerjs'
    },options);
};
Lobby.prototype.connect = function(){
    console.log('connecting');
    return new Promise(resolve=>{
        this.socket = io(this.ws_url,{path:this._options.lobbyPath});
        this.socket.on('connect',()=>{resolve(this.socket)});
    })
};
Lobby.prototype.getRooms = function(){
    this.socket.emit('rooms',null,(rooms)=>{})
};
Lobby.prototype.quickFind = function(){
    var self = this;
    return new Promise(resolve=>{
        self.socket.emit('quick-find',null,room=>{resolve(room)});
    })
}

Lobby.prototype.quickJoin = function(){
    var self = this;
    return new Promise(resolve=>{
        self.quickFind().then(_room =>{
            var room = new _Room(self,self._options)
            room.join(_room.id);
            resolve(room);
        });
    })
};
Lobby.prototype.joinRoom = function(roomId){
    return new Promise(resolve=>{
        var r = new _Room(this,this._options);
        r.join(roomId).then(d=>resolve(r));
    })
};
Lobby.prototype.destroy = function(){
    this.socket.disconnect();
};
var _Room = function(lobby,options){
    this._options = options;
    this.lobby = lobby;
    this.socket = this.lobby.socket;
    this.peer = null;
    this.starting = {};
    this.game = null;

    this.socket.on('disconnect', function (){console.log('disconnected')});
    this.socket.on('connect-to',this.connectTo.bind(this));
    this.socket.on('set-host',this.setHost.bind(this));
    this.socket.on('can-start',this.start.bind(this));

    this.onHostSet = new signals.Signal();
    this.onPeerConnected = new signals.Signal();
    this.onPeerDisconnected = new signals.Signal();
    this.onDataReceived = new signals.Signal();
};
_Room.prototype.join = function(id){
    return new Promise(resolve=>{
        this.peer = new Peer(this.socket.id,{key: id,host:'localhost',port:3000,path:'/peerjs'});
        this.peer.on('error',error=>{
            console.log(error);
            this.peer.destroy();
        });
        this.peer.on('connection',this.onConnection.bind(this));

        this.peer.on('open', () => {
            this.id = id;
            resolve()
        });
    })
};

_Room.prototype.start = function(){
    this.socket.emit('start-room',this.id)
};
_Room.prototype.connectTo = function(id){
    if(this.peer.connections[id]) return;
    this.starting[id] = new Date();
    return this.onConnection(this.peer.connect(id));
};
_Room.prototype.onConnection = function(conn){
    return new Promise(resolve=>{
        conn.on('open',()=>{
            resolve();
            this.onPeerConnected.dispatch(conn);
        });
        conn.on('data',data=>{
            this.onDataReceived.dispatch(data)
        });
        conn.on('close',()=>{
            this.onPeerDisconnected.dispatch(conn.peer);
            delete this.peer.connections[conn.peer];
        })
    })


}
_Room.prototype.setHost = function(peer){
    var previousHost = this.host;
    this.host = peer;
    this.isHost = this.host == this.socket.id;
    this.onHostSet.dispatch();
    // if(!this.game)
    //     this.game = new GameBroker(this)
    // else{
    //     this.game.updateHost(previousHost);
    // }
};
_Room.prototype.destroy = function(){
    this.peer && this.peer.destroy();
    this.onHostSet.removeAll()
    this.onPeerConnected.removeAll();
    this.onPeerDisconnected.removeAll();
};
var Notification = function(){
    this.data = {};
    this.newPlayer = function(id){
        this.data['np'] = this.data['np'] || {};
        this.data['np'][id]=1;
    };
    this.removePlayer = function(id){
        this.data['rp'] = this.data['rp'] || {};
        this.data['rp'][id]=1;
    };
    this.addPosition = function(id,position){
        this.data['p'] = this.data['p'] || {};
        this.data['p'][id]=position;
    };
    this.reset = function(){
        this.data = {};
    };
    this.toObject = function(){
        return this.data;
    }
};
var GameBroker = function(room,options){
    this.options = _.extend({
        updateStep:1000
    },options)
    this.socket = room.socket;
    this.room = room;
    this.peer = this.room.peer;
    this.nextUpdateData = new Notification();

    this.onDataReceived = this.room.onDataReceived;
    this.onHostChanged = this.room.onHostSet;
    this.onPlayerConnected = new signals.Signal();
    this.onPlayerDisconnected = new signals.Signal();
    this.room.onPeerConnected.add(conn=>this.room.isHost && this.onPlayerConnected.dispatch(conn));
    this.room.onPeerDisconnected.add(id=>this.room.isHost && this.onPlayerDisconnected.dispatch(id));

    this.sendUpdate();
};

GameBroker.prototype.sendUpdate = function(){
    var data;
    if(this.peer && this.room.host){
        data = this.nextUpdateData.toObject();
        if(!Object.keys(data).length) return;
        if(this.room.isHost){
            for(var connId in this.peer.connections){
                this.peer.connections[connId][0].send(data)
            }
        }else{
            this.peer.connections[this.room.host] && this.peer.connections[this.room.host][0].send(data)
        }
    }
    this.nextUpdateData.reset();
    setTimeout(this.sendUpdate.bind(this),this.options.updateStep);
};

GameBroker.prototype.destroy = function(){
    this.room.destroy()
};
var Player = function(){
    this.position = 1;
    this.vel = 1;
    this.step = function(){
        this.position += this.vel;
    }
}
var Game = function(broker,options){
    this.broker = broker;
    this.players = {};
    this.run = false;
    this.options = _.extend({stepTime:100,options});

};
Game.prototype = {
    addPlayer:function(id){
        this.players[id] = new Player()
    },
    removePlayer:function(id){
        delete this.players[id]
    },
    step:function(){
        if(this.run){
            var pId = _.randOptions(Object.keys(this.players));
            this.players[pId].step();
            this.broker.nextUpdateData.addPosition(pId,this.players[pId].position);
        }
    },
    updateState:function(data){
        if(data.np)
            for (var i in data.np)
                this.addPlayer(i);
        if(data.rp)
            for (var i in data.np)
                this.removePlayer(i);

        if(data.p)
            for (var id in data.p)
                this.players[id].position = data.p[id]
    },
    initialState:function(){
        for(var id in this.players){
            this.broker.nextUpdateData.newPlayer(id);
            this.broker.nextUpdateData.addPosition(id, this.players[id].position);
        }
    }
}

module.exports = {
    Lobby:Lobby,
    GameBroker:GameBroker
};
window.Lobby = Lobby;
window.GameBroker = GameBroker;
window.Game = Game;

},{"../util":16,"./socket.io.js":15,"peerjs":7,"signals":13}],15:[function(require,module,exports){
!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.io=e():t.io=e()}(this,function(){return function(t){function e(r){if(n[r])return n[r].exports;var o=n[r]={exports:{},id:r,loaded:!1};return t[r].call(o.exports,o,o.exports,e),o.loaded=!0,o.exports}var n={};return e.m=t,e.c=n,e.p="",e(0)}([function(t,e,n){"use strict";function r(t,e){"object"===("undefined"==typeof t?"undefined":o(t))&&(e=t,t=void 0),e=e||{};var n,r=i(t),s=r.source,u=r.id,h=r.path,f=p[u]&&h in p[u].nsps,l=e.forceNew||e["force new connection"]||!1===e.multiplex||f;return l?(c("ignoring socket cache for %s",s),n=a(s,e)):(p[u]||(c("new io instance for %s",s),p[u]=a(s,e)),n=p[u]),r.query&&!e.query&&(e.query=r.query),n.socket(r.path,e)}var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},i=n(1),s=n(7),a=n(13),c=n(3)("socket.io-client");t.exports=e=r;var p=e.managers={};e.protocol=s.protocol,e.connect=r,e.Manager=n(13),e.Socket=n(39)},function(t,e,n){(function(e){"use strict";function r(t,n){var r=t;n=n||e.location,null==t&&(t=n.protocol+"//"+n.host),"string"==typeof t&&("/"===t.charAt(0)&&(t="/"===t.charAt(1)?n.protocol+t:n.host+t),/^(https?|wss?):\/\//.test(t)||(i("protocol-less url %s",t),t="undefined"!=typeof n?n.protocol+"//"+t:"https://"+t),i("parse %s",t),r=o(t)),r.port||(/^(http|ws)$/.test(r.protocol)?r.port="80":/^(http|ws)s$/.test(r.protocol)&&(r.port="443")),r.path=r.path||"/";var s=r.host.indexOf(":")!==-1,a=s?"["+r.host+"]":r.host;return r.id=r.protocol+"://"+a+":"+r.port,r.href=r.protocol+"://"+a+(n&&n.port===r.port?"":":"+r.port),r}var o=n(2),i=n(3)("socket.io-client:url");t.exports=r}).call(e,function(){return this}())},function(t,e){var n=/^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,r=["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"];t.exports=function(t){var e=t,o=t.indexOf("["),i=t.indexOf("]");o!=-1&&i!=-1&&(t=t.substring(0,o)+t.substring(o,i).replace(/:/g,";")+t.substring(i,t.length));for(var s=n.exec(t||""),a={},c=14;c--;)a[r[c]]=s[c]||"";return o!=-1&&i!=-1&&(a.source=e,a.host=a.host.substring(1,a.host.length-1).replace(/;/g,":"),a.authority=a.authority.replace("[","").replace("]","").replace(/;/g,":"),a.ipv6uri=!0),a}},function(t,e,n){(function(r){function o(){return!("undefined"==typeof window||!window.process||"renderer"!==window.process.type)||("undefined"!=typeof document&&document.documentElement&&document.documentElement.style&&document.documentElement.style.WebkitAppearance||"undefined"!=typeof window&&window.console&&(window.console.firebug||window.console.exception&&window.console.table)||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)&&parseInt(RegExp.$1,10)>=31||"undefined"!=typeof navigator&&navigator.userAgent&&navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))}function i(t){var n=this.useColors;if(t[0]=(n?"%c":"")+this.namespace+(n?" %c":" ")+t[0]+(n?"%c ":" ")+"+"+e.humanize(this.diff),n){var r="color: "+this.color;t.splice(1,0,r,"color: inherit");var o=0,i=0;t[0].replace(/%[a-zA-Z%]/g,function(t){"%%"!==t&&(o++,"%c"===t&&(i=o))}),t.splice(i,0,r)}}function s(){return"object"==typeof console&&console.log&&Function.prototype.apply.call(console.log,console,arguments)}function a(t){try{null==t?e.storage.removeItem("debug"):e.storage.debug=t}catch(n){}}function c(){var t;try{t=e.storage.debug}catch(n){}return!t&&"undefined"!=typeof r&&"env"in r&&(t=r.env.DEBUG),t}function p(){try{return window.localStorage}catch(t){}}e=t.exports=n(5),e.log=s,e.formatArgs=i,e.save=a,e.load=c,e.useColors=o,e.storage="undefined"!=typeof chrome&&"undefined"!=typeof chrome.storage?chrome.storage.local:p(),e.colors=["lightseagreen","forestgreen","goldenrod","dodgerblue","darkorchid","crimson"],e.formatters.j=function(t){try{return JSON.stringify(t)}catch(e){return"[UnexpectedJSONParseError]: "+e.message}},e.enable(c())}).call(e,n(4))},function(t,e){function n(){throw new Error("setTimeout has not been defined")}function r(){throw new Error("clearTimeout has not been defined")}function o(t){if(u===setTimeout)return setTimeout(t,0);if((u===n||!u)&&setTimeout)return u=setTimeout,setTimeout(t,0);try{return u(t,0)}catch(e){try{return u.call(null,t,0)}catch(e){return u.call(this,t,0)}}}function i(t){if(h===clearTimeout)return clearTimeout(t);if((h===r||!h)&&clearTimeout)return h=clearTimeout,clearTimeout(t);try{return h(t)}catch(e){try{return h.call(null,t)}catch(e){return h.call(this,t)}}}function s(){y&&l&&(y=!1,l.length?d=l.concat(d):m=-1,d.length&&a())}function a(){if(!y){var t=o(s);y=!0;for(var e=d.length;e;){for(l=d,d=[];++m<e;)l&&l[m].run();m=-1,e=d.length}l=null,y=!1,i(t)}}function c(t,e){this.fun=t,this.array=e}function p(){}var u,h,f=t.exports={};!function(){try{u="function"==typeof setTimeout?setTimeout:n}catch(t){u=n}try{h="function"==typeof clearTimeout?clearTimeout:r}catch(t){h=r}}();var l,d=[],y=!1,m=-1;f.nextTick=function(t){var e=new Array(arguments.length-1);if(arguments.length>1)for(var n=1;n<arguments.length;n++)e[n-1]=arguments[n];d.push(new c(t,e)),1!==d.length||y||o(a)},c.prototype.run=function(){this.fun.apply(null,this.array)},f.title="browser",f.browser=!0,f.env={},f.argv=[],f.version="",f.versions={},f.on=p,f.addListener=p,f.once=p,f.off=p,f.removeListener=p,f.removeAllListeners=p,f.emit=p,f.prependListener=p,f.prependOnceListener=p,f.listeners=function(t){return[]},f.binding=function(t){throw new Error("process.binding is not supported")},f.cwd=function(){return"/"},f.chdir=function(t){throw new Error("process.chdir is not supported")},f.umask=function(){return 0}},function(t,e,n){function r(t){var n,r=0;for(n in t)r=(r<<5)-r+t.charCodeAt(n),r|=0;return e.colors[Math.abs(r)%e.colors.length]}function o(t){function n(){if(n.enabled){var t=n,r=+new Date,o=r-(p||r);t.diff=o,t.prev=p,t.curr=r,p=r;for(var i=new Array(arguments.length),s=0;s<i.length;s++)i[s]=arguments[s];i[0]=e.coerce(i[0]),"string"!=typeof i[0]&&i.unshift("%O");var a=0;i[0]=i[0].replace(/%([a-zA-Z%])/g,function(n,r){if("%%"===n)return n;a++;var o=e.formatters[r];if("function"==typeof o){var s=i[a];n=o.call(t,s),i.splice(a,1),a--}return n}),e.formatArgs.call(t,i);var c=n.log||e.log||console.log.bind(console);c.apply(t,i)}}return n.namespace=t,n.enabled=e.enabled(t),n.useColors=e.useColors(),n.color=r(t),"function"==typeof e.init&&e.init(n),n}function i(t){e.save(t),e.names=[],e.skips=[];for(var n=("string"==typeof t?t:"").split(/[\s,]+/),r=n.length,o=0;o<r;o++)n[o]&&(t=n[o].replace(/\*/g,".*?"),"-"===t[0]?e.skips.push(new RegExp("^"+t.substr(1)+"$")):e.names.push(new RegExp("^"+t+"$")))}function s(){e.enable("")}function a(t){var n,r;for(n=0,r=e.skips.length;n<r;n++)if(e.skips[n].test(t))return!1;for(n=0,r=e.names.length;n<r;n++)if(e.names[n].test(t))return!0;return!1}function c(t){return t instanceof Error?t.stack||t.message:t}e=t.exports=o.debug=o["default"]=o,e.coerce=c,e.disable=s,e.enable=i,e.enabled=a,e.humanize=n(6),e.names=[],e.skips=[],e.formatters={};var p},function(t,e){function n(t){if(t=String(t),!(t.length>100)){var e=/^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(t);if(e){var n=parseFloat(e[1]),r=(e[2]||"ms").toLowerCase();switch(r){case"years":case"year":case"yrs":case"yr":case"y":return n*u;case"days":case"day":case"d":return n*p;case"hours":case"hour":case"hrs":case"hr":case"h":return n*c;case"minutes":case"minute":case"mins":case"min":case"m":return n*a;case"seconds":case"second":case"secs":case"sec":case"s":return n*s;case"milliseconds":case"millisecond":case"msecs":case"msec":case"ms":return n;default:return}}}}function r(t){return t>=p?Math.round(t/p)+"d":t>=c?Math.round(t/c)+"h":t>=a?Math.round(t/a)+"m":t>=s?Math.round(t/s)+"s":t+"ms"}function o(t){return i(t,p,"day")||i(t,c,"hour")||i(t,a,"minute")||i(t,s,"second")||t+" ms"}function i(t,e,n){if(!(t<e))return t<1.5*e?Math.floor(t/e)+" "+n:Math.ceil(t/e)+" "+n+"s"}var s=1e3,a=60*s,c=60*a,p=24*c,u=365.25*p;t.exports=function(t,e){e=e||{};var i=typeof t;if("string"===i&&t.length>0)return n(t);if("number"===i&&isNaN(t)===!1)return e["long"]?o(t):r(t);throw new Error("val is not a non-empty string or a valid number. val="+JSON.stringify(t))}},function(t,e,n){function r(){}function o(t){var n=""+t.type;return e.BINARY_EVENT!==t.type&&e.BINARY_ACK!==t.type||(n+=t.attachments+"-"),t.nsp&&"/"!==t.nsp&&(n+=t.nsp+","),null!=t.id&&(n+=t.id),null!=t.data&&(n+=JSON.stringify(t.data)),h("encoded %j as %s",t,n),n}function i(t,e){function n(t){var n=d.deconstructPacket(t),r=o(n.packet),i=n.buffers;i.unshift(r),e(i)}d.removeBlobs(t,n)}function s(){this.reconstructor=null}function a(t){var n=0,r={type:Number(t.charAt(0))};if(null==e.types[r.type])return u();if(e.BINARY_EVENT===r.type||e.BINARY_ACK===r.type){for(var o="";"-"!==t.charAt(++n)&&(o+=t.charAt(n),n!=t.length););if(o!=Number(o)||"-"!==t.charAt(n))throw new Error("Illegal attachments");r.attachments=Number(o)}if("/"===t.charAt(n+1))for(r.nsp="";++n;){var i=t.charAt(n);if(","===i)break;if(r.nsp+=i,n===t.length)break}else r.nsp="/";var s=t.charAt(n+1);if(""!==s&&Number(s)==s){for(r.id="";++n;){var i=t.charAt(n);if(null==i||Number(i)!=i){--n;break}if(r.id+=t.charAt(n),n===t.length)break}r.id=Number(r.id)}return t.charAt(++n)&&(r=c(r,t.substr(n))),h("decoded %s as %j",t,r),r}function c(t,e){try{t.data=JSON.parse(e)}catch(n){return u()}return t}function p(t){this.reconPack=t,this.buffers=[]}function u(){return{type:e.ERROR,data:"parser error"}}var h=n(3)("socket.io-parser"),f=n(8),l=n(9),d=n(11),y=n(12);e.protocol=4,e.types=["CONNECT","DISCONNECT","EVENT","ACK","ERROR","BINARY_EVENT","BINARY_ACK"],e.CONNECT=0,e.DISCONNECT=1,e.EVENT=2,e.ACK=3,e.ERROR=4,e.BINARY_EVENT=5,e.BINARY_ACK=6,e.Encoder=r,e.Decoder=s,r.prototype.encode=function(t,n){if(t.type!==e.EVENT&&t.type!==e.ACK||!l(t.data)||(t.type=t.type===e.EVENT?e.BINARY_EVENT:e.BINARY_ACK),h("encoding packet %j",t),e.BINARY_EVENT===t.type||e.BINARY_ACK===t.type)i(t,n);else{var r=o(t);n([r])}},f(s.prototype),s.prototype.add=function(t){var n;if("string"==typeof t)n=a(t),e.BINARY_EVENT===n.type||e.BINARY_ACK===n.type?(this.reconstructor=new p(n),0===this.reconstructor.reconPack.attachments&&this.emit("decoded",n)):this.emit("decoded",n);else{if(!y(t)&&!t.base64)throw new Error("Unknown type: "+t);if(!this.reconstructor)throw new Error("got binary data when not reconstructing a packet");n=this.reconstructor.takeBinaryData(t),n&&(this.reconstructor=null,this.emit("decoded",n))}},s.prototype.destroy=function(){this.reconstructor&&this.reconstructor.finishedReconstruction()},p.prototype.takeBinaryData=function(t){if(this.buffers.push(t),this.buffers.length===this.reconPack.attachments){var e=d.reconstructPacket(this.reconPack,this.buffers);return this.finishedReconstruction(),e}return null},p.prototype.finishedReconstruction=function(){this.reconPack=null,this.buffers=[]}},function(t,e,n){function r(t){if(t)return o(t)}function o(t){for(var e in r.prototype)t[e]=r.prototype[e];return t}t.exports=r,r.prototype.on=r.prototype.addEventListener=function(t,e){return this._callbacks=this._callbacks||{},(this._callbacks["$"+t]=this._callbacks["$"+t]||[]).push(e),this},r.prototype.once=function(t,e){function n(){this.off(t,n),e.apply(this,arguments)}return n.fn=e,this.on(t,n),this},r.prototype.off=r.prototype.removeListener=r.prototype.removeAllListeners=r.prototype.removeEventListener=function(t,e){if(this._callbacks=this._callbacks||{},0==arguments.length)return this._callbacks={},this;var n=this._callbacks["$"+t];if(!n)return this;if(1==arguments.length)return delete this._callbacks["$"+t],this;for(var r,o=0;o<n.length;o++)if(r=n[o],r===e||r.fn===e){n.splice(o,1);break}return this},r.prototype.emit=function(t){this._callbacks=this._callbacks||{};var e=[].slice.call(arguments,1),n=this._callbacks["$"+t];if(n){n=n.slice(0);for(var r=0,o=n.length;r<o;++r)n[r].apply(this,e)}return this},r.prototype.listeners=function(t){return this._callbacks=this._callbacks||{},this._callbacks["$"+t]||[]},r.prototype.hasListeners=function(t){return!!this.listeners(t).length}},function(t,e,n){(function(e){function r(t){if(!t||"object"!=typeof t)return!1;if(o(t)){for(var n=0,i=t.length;n<i;n++)if(r(t[n]))return!0;return!1}if("function"==typeof e.Buffer&&e.Buffer.isBuffer&&e.Buffer.isBuffer(t)||"function"==typeof e.ArrayBuffer&&t instanceof ArrayBuffer||s&&t instanceof Blob||a&&t instanceof File)return!0;if(t.toJSON&&"function"==typeof t.toJSON&&1===arguments.length)return r(t.toJSON(),!0);for(var c in t)if(Object.prototype.hasOwnProperty.call(t,c)&&r(t[c]))return!0;return!1}var o=n(10),i=Object.prototype.toString,s="function"==typeof e.Blob||"[object BlobConstructor]"===i.call(e.Blob),a="function"==typeof e.File||"[object FileConstructor]"===i.call(e.File);t.exports=r}).call(e,function(){return this}())},function(t,e){var n={}.toString;t.exports=Array.isArray||function(t){return"[object Array]"==n.call(t)}},function(t,e,n){(function(t){function r(t,e){if(!t)return t;if(s(t)){var n={_placeholder:!0,num:e.length};return e.push(t),n}if(i(t)){for(var o=new Array(t.length),a=0;a<t.length;a++)o[a]=r(t[a],e);return o}if("object"==typeof t&&!(t instanceof Date)){var o={};for(var c in t)o[c]=r(t[c],e);return o}return t}function o(t,e){if(!t)return t;if(t&&t._placeholder)return e[t.num];if(i(t))for(var n=0;n<t.length;n++)t[n]=o(t[n],e);else if("object"==typeof t)for(var r in t)t[r]=o(t[r],e);return t}var i=n(10),s=n(12),a=Object.prototype.toString,c="function"==typeof t.Blob||"[object BlobConstructor]"===a.call(t.Blob),p="function"==typeof t.File||"[object FileConstructor]"===a.call(t.File);e.deconstructPacket=function(t){var e=[],n=t.data,o=t;return o.data=r(n,e),o.attachments=e.length,{packet:o,buffers:e}},e.reconstructPacket=function(t,e){return t.data=o(t.data,e),t.attachments=void 0,t},e.removeBlobs=function(t,e){function n(t,a,u){if(!t)return t;if(c&&t instanceof Blob||p&&t instanceof File){r++;var h=new FileReader;h.onload=function(){u?u[a]=this.result:o=this.result,--r||e(o)},h.readAsArrayBuffer(t)}else if(i(t))for(var f=0;f<t.length;f++)n(t[f],f,t);else if("object"==typeof t&&!s(t))for(var l in t)n(t[l],l,t)}var r=0,o=t;n(o),r||e(o)}}).call(e,function(){return this}())},function(t,e){(function(e){function n(t){return e.Buffer&&e.Buffer.isBuffer(t)||e.ArrayBuffer&&t instanceof ArrayBuffer}t.exports=n}).call(e,function(){return this}())},function(t,e,n){"use strict";function r(t,e){if(!(this instanceof r))return new r(t,e);t&&"object"===("undefined"==typeof t?"undefined":o(t))&&(e=t,t=void 0),e=e||{},e.path=e.path||"/socket.io",this.nsps={},this.subs=[],this.opts=e,this.reconnection(e.reconnection!==!1),this.reconnectionAttempts(e.reconnectionAttempts||1/0),this.reconnectionDelay(e.reconnectionDelay||1e3),this.reconnectionDelayMax(e.reconnectionDelayMax||5e3),this.randomizationFactor(e.randomizationFactor||.5),this.backoff=new l({min:this.reconnectionDelay(),max:this.reconnectionDelayMax(),jitter:this.randomizationFactor()}),this.timeout(null==e.timeout?2e4:e.timeout),this.readyState="closed",this.uri=t,this.connecting=[],this.lastPing=null,this.encoding=!1,this.packetBuffer=[];var n=e.parser||c;this.encoder=new n.Encoder,this.decoder=new n.Decoder,this.autoConnect=e.autoConnect!==!1,this.autoConnect&&this.open()}var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},i=n(14),s=n(39),a=n(8),c=n(7),p=n(41),u=n(42),h=n(3)("socket.io-client:manager"),f=n(37),l=n(43),d=Object.prototype.hasOwnProperty;t.exports=r,r.prototype.emitAll=function(){this.emit.apply(this,arguments);for(var t in this.nsps)d.call(this.nsps,t)&&this.nsps[t].emit.apply(this.nsps[t],arguments)},r.prototype.updateSocketIds=function(){for(var t in this.nsps)d.call(this.nsps,t)&&(this.nsps[t].id=this.generateId(t))},r.prototype.generateId=function(t){return("/"===t?"":t+"#")+this.engine.id},a(r.prototype),r.prototype.reconnection=function(t){return arguments.length?(this._reconnection=!!t,this):this._reconnection},r.prototype.reconnectionAttempts=function(t){return arguments.length?(this._reconnectionAttempts=t,this):this._reconnectionAttempts},r.prototype.reconnectionDelay=function(t){return arguments.length?(this._reconnectionDelay=t,this.backoff&&this.backoff.setMin(t),this):this._reconnectionDelay},r.prototype.randomizationFactor=function(t){return arguments.length?(this._randomizationFactor=t,this.backoff&&this.backoff.setJitter(t),this):this._randomizationFactor},r.prototype.reconnectionDelayMax=function(t){return arguments.length?(this._reconnectionDelayMax=t,this.backoff&&this.backoff.setMax(t),this):this._reconnectionDelayMax},r.prototype.timeout=function(t){return arguments.length?(this._timeout=t,this):this._timeout},r.prototype.maybeReconnectOnOpen=function(){!this.reconnecting&&this._reconnection&&0===this.backoff.attempts&&this.reconnect()},r.prototype.open=r.prototype.connect=function(t,e){if(h("readyState %s",this.readyState),~this.readyState.indexOf("open"))return this;h("opening %s",this.uri),this.engine=i(this.uri,this.opts);var n=this.engine,r=this;this.readyState="opening",this.skipReconnect=!1;var o=p(n,"open",function(){r.onopen(),t&&t()}),s=p(n,"error",function(e){if(h("connect_error"),r.cleanup(),r.readyState="closed",r.emitAll("connect_error",e),t){var n=new Error("Connection error");n.data=e,t(n)}else r.maybeReconnectOnOpen()});if(!1!==this._timeout){var a=this._timeout;h("connect attempt will timeout after %d",a);var c=setTimeout(function(){h("connect attempt timed out after %d",a),o.destroy(),n.close(),n.emit("error","timeout"),r.emitAll("connect_timeout",a)},a);this.subs.push({destroy:function(){clearTimeout(c)}})}return this.subs.push(o),this.subs.push(s),this},r.prototype.onopen=function(){h("open"),this.cleanup(),this.readyState="open",this.emit("open");var t=this.engine;this.subs.push(p(t,"data",u(this,"ondata"))),this.subs.push(p(t,"ping",u(this,"onping"))),this.subs.push(p(t,"pong",u(this,"onpong"))),this.subs.push(p(t,"error",u(this,"onerror"))),this.subs.push(p(t,"close",u(this,"onclose"))),this.subs.push(p(this.decoder,"decoded",u(this,"ondecoded")))},r.prototype.onping=function(){this.lastPing=new Date,this.emitAll("ping")},r.prototype.onpong=function(){this.emitAll("pong",new Date-this.lastPing)},r.prototype.ondata=function(t){this.decoder.add(t)},r.prototype.ondecoded=function(t){this.emit("packet",t)},r.prototype.onerror=function(t){h("error",t),this.emitAll("error",t)},r.prototype.socket=function(t,e){function n(){~f(o.connecting,r)||o.connecting.push(r)}var r=this.nsps[t];if(!r){r=new s(this,t,e),this.nsps[t]=r;var o=this;r.on("connecting",n),r.on("connect",function(){r.id=o.generateId(t)}),this.autoConnect&&n()}return r},r.prototype.destroy=function(t){var e=f(this.connecting,t);~e&&this.connecting.splice(e,1),this.connecting.length||this.close()},r.prototype.packet=function(t){h("writing packet %j",t);var e=this;t.query&&0===t.type&&(t.nsp+="?"+t.query),e.encoding?e.packetBuffer.push(t):(e.encoding=!0,this.encoder.encode(t,function(n){for(var r=0;r<n.length;r++)e.engine.write(n[r],t.options);e.encoding=!1,e.processPacketQueue()}))},r.prototype.processPacketQueue=function(){if(this.packetBuffer.length>0&&!this.encoding){var t=this.packetBuffer.shift();this.packet(t)}},r.prototype.cleanup=function(){h("cleanup");for(var t=this.subs.length,e=0;e<t;e++){var n=this.subs.shift();n.destroy()}this.packetBuffer=[],this.encoding=!1,this.lastPing=null,this.decoder.destroy()},r.prototype.close=r.prototype.disconnect=function(){h("disconnect"),this.skipReconnect=!0,this.reconnecting=!1,"opening"===this.readyState&&this.cleanup(),this.backoff.reset(),this.readyState="closed",this.engine&&this.engine.close()},r.prototype.onclose=function(t){h("onclose"),this.cleanup(),this.backoff.reset(),this.readyState="closed",this.emit("close",t),this._reconnection&&!this.skipReconnect&&this.reconnect()},r.prototype.reconnect=function(){if(this.reconnecting||this.skipReconnect)return this;var t=this;if(this.backoff.attempts>=this._reconnectionAttempts)h("reconnect failed"),this.backoff.reset(),this.emitAll("reconnect_failed"),this.reconnecting=!1;else{var e=this.backoff.duration();h("will wait %dms before reconnect attempt",e),this.reconnecting=!0;var n=setTimeout(function(){t.skipReconnect||(h("attempting reconnect"),t.emitAll("reconnect_attempt",t.backoff.attempts),t.emitAll("reconnecting",t.backoff.attempts),t.skipReconnect||t.open(function(e){e?(h("reconnect attempt error"),t.reconnecting=!1,t.reconnect(),t.emitAll("reconnect_error",e.data)):(h("reconnect success"),t.onreconnect())}))},e);this.subs.push({destroy:function(){clearTimeout(n)}})}},r.prototype.onreconnect=function(){var t=this.backoff.attempts;this.reconnecting=!1,this.backoff.reset(),this.updateSocketIds(),this.emitAll("reconnect",t)}},function(t,e,n){t.exports=n(15)},function(t,e,n){t.exports=n(16),t.exports.parser=n(23)},function(t,e,n){(function(e){function r(t,n){if(!(this instanceof r))return new r(t,n);n=n||{},t&&"object"==typeof t&&(n=t,t=null),t?(t=u(t),n.hostname=t.host,n.secure="https"===t.protocol||"wss"===t.protocol,n.port=t.port,t.query&&(n.query=t.query)):n.host&&(n.hostname=u(n.host).host),this.secure=null!=n.secure?n.secure:e.location&&"https:"===location.protocol,n.hostname&&!n.port&&(n.port=this.secure?"443":"80"),this.agent=n.agent||!1,this.hostname=n.hostname||(e.location?location.hostname:"localhost"),this.port=n.port||(e.location&&location.port?location.port:this.secure?443:80),this.query=n.query||{},"string"==typeof this.query&&(this.query=f.decode(this.query)),this.upgrade=!1!==n.upgrade,this.path=(n.path||"/engine.io").replace(/\/$/,"")+"/",this.forceJSONP=!!n.forceJSONP,this.jsonp=!1!==n.jsonp,this.forceBase64=!!n.forceBase64,this.enablesXDR=!!n.enablesXDR,this.timestampParam=n.timestampParam||"t",this.timestampRequests=n.timestampRequests,this.transports=n.transports||["polling","websocket"],this.transportOptions=n.transportOptions||{},this.readyState="",this.writeBuffer=[],this.prevBufferLen=0,this.policyPort=n.policyPort||843,this.rememberUpgrade=n.rememberUpgrade||!1,this.binaryType=null,this.onlyBinaryUpgrades=n.onlyBinaryUpgrades,this.perMessageDeflate=!1!==n.perMessageDeflate&&(n.perMessageDeflate||{}),!0===this.perMessageDeflate&&(this.perMessageDeflate={}),this.perMessageDeflate&&null==this.perMessageDeflate.threshold&&(this.perMessageDeflate.threshold=1024),this.pfx=n.pfx||null,this.key=n.key||null,this.passphrase=n.passphrase||null,this.cert=n.cert||null,this.ca=n.ca||null,this.ciphers=n.ciphers||null,this.rejectUnauthorized=void 0===n.rejectUnauthorized||n.rejectUnauthorized,this.forceNode=!!n.forceNode;var o="object"==typeof e&&e;o.global===o&&(n.extraHeaders&&Object.keys(n.extraHeaders).length>0&&(this.extraHeaders=n.extraHeaders),n.localAddress&&(this.localAddress=n.localAddress)),this.id=null,this.upgrades=null,this.pingInterval=null,this.pingTimeout=null,this.pingIntervalTimer=null,this.pingTimeoutTimer=null,this.open()}function o(t){var e={};for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n]);return e}var i=n(17),s=n(8),a=n(3)("engine.io-client:socket"),c=n(37),p=n(23),u=n(2),h=n(38),f=n(31);t.exports=r,r.priorWebsocketSuccess=!1,s(r.prototype),r.protocol=p.protocol,r.Socket=r,r.Transport=n(22),r.transports=n(17),r.parser=n(23),r.prototype.createTransport=function(t){a('creating transport "%s"',t);var e=o(this.query);e.EIO=p.protocol,e.transport=t;var n=this.transportOptions[t]||{};this.id&&(e.sid=this.id);var r=new i[t]({query:e,socket:this,agent:n.agent||this.agent,hostname:n.hostname||this.hostname,port:n.port||this.port,secure:n.secure||this.secure,path:n.path||this.path,forceJSONP:n.forceJSONP||this.forceJSONP,jsonp:n.jsonp||this.jsonp,forceBase64:n.forceBase64||this.forceBase64,enablesXDR:n.enablesXDR||this.enablesXDR,timestampRequests:n.timestampRequests||this.timestampRequests,timestampParam:n.timestampParam||this.timestampParam,policyPort:n.policyPort||this.policyPort,pfx:n.pfx||this.pfx,key:n.key||this.key,passphrase:n.passphrase||this.passphrase,cert:n.cert||this.cert,ca:n.ca||this.ca,ciphers:n.ciphers||this.ciphers,rejectUnauthorized:n.rejectUnauthorized||this.rejectUnauthorized,perMessageDeflate:n.perMessageDeflate||this.perMessageDeflate,extraHeaders:n.extraHeaders||this.extraHeaders,forceNode:n.forceNode||this.forceNode,localAddress:n.localAddress||this.localAddress,requestTimeout:n.requestTimeout||this.requestTimeout,protocols:n.protocols||void 0});return r},r.prototype.open=function(){var t;if(this.rememberUpgrade&&r.priorWebsocketSuccess&&this.transports.indexOf("websocket")!==-1)t="websocket";else{if(0===this.transports.length){var e=this;return void setTimeout(function(){e.emit("error","No transports available")},0)}t=this.transports[0]}this.readyState="opening";try{t=this.createTransport(t)}catch(n){return this.transports.shift(),void this.open()}t.open(),this.setTransport(t)},r.prototype.setTransport=function(t){a("setting transport %s",t.name);var e=this;this.transport&&(a("clearing existing transport %s",this.transport.name),this.transport.removeAllListeners()),this.transport=t,t.on("drain",function(){e.onDrain()}).on("packet",function(t){e.onPacket(t)}).on("error",function(t){e.onError(t)}).on("close",function(){e.onClose("transport close")})},r.prototype.probe=function(t){function e(){if(f.onlyBinaryUpgrades){var e=!this.supportsBinary&&f.transport.supportsBinary;h=h||e}h||(a('probe transport "%s" opened',t),u.send([{type:"ping",data:"probe"}]),u.once("packet",function(e){if(!h)if("pong"===e.type&&"probe"===e.data){if(a('probe transport "%s" pong',t),f.upgrading=!0,f.emit("upgrading",u),!u)return;r.priorWebsocketSuccess="websocket"===u.name,a('pausing current transport "%s"',f.transport.name),f.transport.pause(function(){h||"closed"!==f.readyState&&(a("changing transport and sending upgrade packet"),p(),f.setTransport(u),u.send([{type:"upgrade"}]),f.emit("upgrade",u),u=null,f.upgrading=!1,f.flush())})}else{a('probe transport "%s" failed',t);var n=new Error("probe error");n.transport=u.name,f.emit("upgradeError",n)}}))}function n(){h||(h=!0,p(),u.close(),u=null)}function o(e){var r=new Error("probe error: "+e);r.transport=u.name,n(),a('probe transport "%s" failed because of error: %s',t,e),f.emit("upgradeError",r)}function i(){o("transport closed")}function s(){o("socket closed")}function c(t){u&&t.name!==u.name&&(a('"%s" works - aborting "%s"',t.name,u.name),n())}function p(){u.removeListener("open",e),u.removeListener("error",o),u.removeListener("close",i),f.removeListener("close",s),f.removeListener("upgrading",c)}a('probing transport "%s"',t);var u=this.createTransport(t,{probe:1}),h=!1,f=this;r.priorWebsocketSuccess=!1,u.once("open",e),u.once("error",o),u.once("close",i),this.once("close",s),this.once("upgrading",c),u.open()},r.prototype.onOpen=function(){if(a("socket open"),this.readyState="open",r.priorWebsocketSuccess="websocket"===this.transport.name,this.emit("open"),this.flush(),"open"===this.readyState&&this.upgrade&&this.transport.pause){a("starting upgrade probes");for(var t=0,e=this.upgrades.length;t<e;t++)this.probe(this.upgrades[t])}},r.prototype.onPacket=function(t){if("opening"===this.readyState||"open"===this.readyState||"closing"===this.readyState)switch(a('socket receive: type "%s", data "%s"',t.type,t.data),this.emit("packet",t),this.emit("heartbeat"),t.type){case"open":this.onHandshake(h(t.data));break;case"pong":this.setPing(),this.emit("pong");break;case"error":var e=new Error("server error");e.code=t.data,this.onError(e);break;case"message":this.emit("data",t.data),this.emit("message",t.data)}else a('packet received with socket readyState "%s"',this.readyState)},r.prototype.onHandshake=function(t){this.emit("handshake",t),this.id=t.sid,this.transport.query.sid=t.sid,this.upgrades=this.filterUpgrades(t.upgrades),this.pingInterval=t.pingInterval,this.pingTimeout=t.pingTimeout,this.onOpen(),"closed"!==this.readyState&&(this.setPing(),this.removeListener("heartbeat",this.onHeartbeat),this.on("heartbeat",this.onHeartbeat))},r.prototype.onHeartbeat=function(t){clearTimeout(this.pingTimeoutTimer);var e=this;e.pingTimeoutTimer=setTimeout(function(){"closed"!==e.readyState&&e.onClose("ping timeout")},t||e.pingInterval+e.pingTimeout)},r.prototype.setPing=function(){var t=this;clearTimeout(t.pingIntervalTimer),t.pingIntervalTimer=setTimeout(function(){a("writing ping packet - expecting pong within %sms",t.pingTimeout),t.ping(),t.onHeartbeat(t.pingTimeout)},t.pingInterval)},r.prototype.ping=function(){var t=this;this.sendPacket("ping",function(){t.emit("ping")})},r.prototype.onDrain=function(){this.writeBuffer.splice(0,this.prevBufferLen),this.prevBufferLen=0,0===this.writeBuffer.length?this.emit("drain"):this.flush()},r.prototype.flush=function(){"closed"!==this.readyState&&this.transport.writable&&!this.upgrading&&this.writeBuffer.length&&(a("flushing %d packets in socket",this.writeBuffer.length),this.transport.send(this.writeBuffer),this.prevBufferLen=this.writeBuffer.length,this.emit("flush"))},r.prototype.write=r.prototype.send=function(t,e,n){return this.sendPacket("message",t,e,n),this},r.prototype.sendPacket=function(t,e,n,r){if("function"==typeof e&&(r=e,e=void 0),"function"==typeof n&&(r=n,n=null),"closing"!==this.readyState&&"closed"!==this.readyState){n=n||{},n.compress=!1!==n.compress;var o={type:t,data:e,options:n};this.emit("packetCreate",o),this.writeBuffer.push(o),r&&this.once("flush",r),this.flush()}},r.prototype.close=function(){function t(){r.onClose("forced close"),a("socket closing - telling transport to close"),r.transport.close()}function e(){r.removeListener("upgrade",e),r.removeListener("upgradeError",e),t()}function n(){r.once("upgrade",e),r.once("upgradeError",e)}if("opening"===this.readyState||"open"===this.readyState){this.readyState="closing";var r=this;this.writeBuffer.length?this.once("drain",function(){this.upgrading?n():t()}):this.upgrading?n():t()}return this},r.prototype.onError=function(t){a("socket error %j",t),r.priorWebsocketSuccess=!1,this.emit("error",t),this.onClose("transport error",t)},r.prototype.onClose=function(t,e){if("opening"===this.readyState||"open"===this.readyState||"closing"===this.readyState){a('socket close with reason: "%s"',t);var n=this;clearTimeout(this.pingIntervalTimer),clearTimeout(this.pingTimeoutTimer),this.transport.removeAllListeners("close"),this.transport.close(),this.transport.removeAllListeners(),this.readyState="closed",this.id=null,this.emit("close",t,e),n.writeBuffer=[],n.prevBufferLen=0}},r.prototype.filterUpgrades=function(t){for(var e=[],n=0,r=t.length;n<r;n++)~c(this.transports,t[n])&&e.push(t[n]);return e}}).call(e,function(){return this}())},function(t,e,n){(function(t){function r(e){var n,r=!1,a=!1,c=!1!==e.jsonp;if(t.location){var p="https:"===location.protocol,u=location.port;u||(u=p?443:80),r=e.hostname!==location.hostname||u!==e.port,a=e.secure!==p}if(e.xdomain=r,e.xscheme=a,n=new o(e),"open"in n&&!e.forceJSONP)return new i(e);if(!c)throw new Error("JSONP disabled");return new s(e)}var o=n(18),i=n(20),s=n(34),a=n(35);e.polling=r,e.websocket=a}).call(e,function(){return this}())},function(t,e,n){(function(e){var r=n(19);t.exports=function(t){var n=t.xdomain,o=t.xscheme,i=t.enablesXDR;try{if("undefined"!=typeof XMLHttpRequest&&(!n||r))return new XMLHttpRequest}catch(s){}try{if("undefined"!=typeof XDomainRequest&&!o&&i)return new XDomainRequest}catch(s){}if(!n)try{
    return new(e[["Active"].concat("Object").join("X")])("Microsoft.XMLHTTP")}catch(s){}}}).call(e,function(){return this}())},function(t,e){try{t.exports="undefined"!=typeof XMLHttpRequest&&"withCredentials"in new XMLHttpRequest}catch(n){t.exports=!1}},function(t,e,n){(function(e){function r(){}function o(t){if(c.call(this,t),this.requestTimeout=t.requestTimeout,this.extraHeaders=t.extraHeaders,e.location){var n="https:"===location.protocol,r=location.port;r||(r=n?443:80),this.xd=t.hostname!==e.location.hostname||r!==t.port,this.xs=t.secure!==n}}function i(t){this.method=t.method||"GET",this.uri=t.uri,this.xd=!!t.xd,this.xs=!!t.xs,this.async=!1!==t.async,this.data=void 0!==t.data?t.data:null,this.agent=t.agent,this.isBinary=t.isBinary,this.supportsBinary=t.supportsBinary,this.enablesXDR=t.enablesXDR,this.requestTimeout=t.requestTimeout,this.pfx=t.pfx,this.key=t.key,this.passphrase=t.passphrase,this.cert=t.cert,this.ca=t.ca,this.ciphers=t.ciphers,this.rejectUnauthorized=t.rejectUnauthorized,this.extraHeaders=t.extraHeaders,this.create()}function s(){for(var t in i.requests)i.requests.hasOwnProperty(t)&&i.requests[t].abort()}var a=n(18),c=n(21),p=n(8),u=n(32),h=n(3)("engine.io-client:polling-xhr");t.exports=o,t.exports.Request=i,u(o,c),o.prototype.supportsBinary=!0,o.prototype.request=function(t){return t=t||{},t.uri=this.uri(),t.xd=this.xd,t.xs=this.xs,t.agent=this.agent||!1,t.supportsBinary=this.supportsBinary,t.enablesXDR=this.enablesXDR,t.pfx=this.pfx,t.key=this.key,t.passphrase=this.passphrase,t.cert=this.cert,t.ca=this.ca,t.ciphers=this.ciphers,t.rejectUnauthorized=this.rejectUnauthorized,t.requestTimeout=this.requestTimeout,t.extraHeaders=this.extraHeaders,new i(t)},o.prototype.doWrite=function(t,e){var n="string"!=typeof t&&void 0!==t,r=this.request({method:"POST",data:t,isBinary:n}),o=this;r.on("success",e),r.on("error",function(t){o.onError("xhr post error",t)}),this.sendXhr=r},o.prototype.doPoll=function(){h("xhr poll");var t=this.request(),e=this;t.on("data",function(t){e.onData(t)}),t.on("error",function(t){e.onError("xhr poll error",t)}),this.pollXhr=t},p(i.prototype),i.prototype.create=function(){var t={agent:this.agent,xdomain:this.xd,xscheme:this.xs,enablesXDR:this.enablesXDR};t.pfx=this.pfx,t.key=this.key,t.passphrase=this.passphrase,t.cert=this.cert,t.ca=this.ca,t.ciphers=this.ciphers,t.rejectUnauthorized=this.rejectUnauthorized;var n=this.xhr=new a(t),r=this;try{h("xhr open %s: %s",this.method,this.uri),n.open(this.method,this.uri,this.async);try{if(this.extraHeaders){n.setDisableHeaderCheck&&n.setDisableHeaderCheck(!0);for(var o in this.extraHeaders)this.extraHeaders.hasOwnProperty(o)&&n.setRequestHeader(o,this.extraHeaders[o])}}catch(s){}if("POST"===this.method)try{this.isBinary?n.setRequestHeader("Content-type","application/octet-stream"):n.setRequestHeader("Content-type","text/plain;charset=UTF-8")}catch(s){}try{n.setRequestHeader("Accept","*/*")}catch(s){}"withCredentials"in n&&(n.withCredentials=!0),this.requestTimeout&&(n.timeout=this.requestTimeout),this.hasXDR()?(n.onload=function(){r.onLoad()},n.onerror=function(){r.onError(n.responseText)}):n.onreadystatechange=function(){if(2===n.readyState){var t;try{t=n.getResponseHeader("Content-Type")}catch(e){}"application/octet-stream"===t&&(n.responseType="arraybuffer")}4===n.readyState&&(200===n.status||1223===n.status?r.onLoad():setTimeout(function(){r.onError(n.status)},0))},h("xhr data %s",this.data),n.send(this.data)}catch(s){return void setTimeout(function(){r.onError(s)},0)}e.document&&(this.index=i.requestsCount++,i.requests[this.index]=this)},i.prototype.onSuccess=function(){this.emit("success"),this.cleanup()},i.prototype.onData=function(t){this.emit("data",t),this.onSuccess()},i.prototype.onError=function(t){this.emit("error",t),this.cleanup(!0)},i.prototype.cleanup=function(t){if("undefined"!=typeof this.xhr&&null!==this.xhr){if(this.hasXDR()?this.xhr.onload=this.xhr.onerror=r:this.xhr.onreadystatechange=r,t)try{this.xhr.abort()}catch(n){}e.document&&delete i.requests[this.index],this.xhr=null}},i.prototype.onLoad=function(){var t;try{var e;try{e=this.xhr.getResponseHeader("Content-Type")}catch(n){}t="application/octet-stream"===e?this.xhr.response||this.xhr.responseText:this.xhr.responseText}catch(n){this.onError(n)}null!=t&&this.onData(t)},i.prototype.hasXDR=function(){return"undefined"!=typeof e.XDomainRequest&&!this.xs&&this.enablesXDR},i.prototype.abort=function(){this.cleanup()},i.requestsCount=0,i.requests={},e.document&&(e.attachEvent?e.attachEvent("onunload",s):e.addEventListener&&e.addEventListener("beforeunload",s,!1))}).call(e,function(){return this}())},function(t,e,n){function r(t){var e=t&&t.forceBase64;u&&!e||(this.supportsBinary=!1),o.call(this,t)}var o=n(22),i=n(31),s=n(23),a=n(32),c=n(33),p=n(3)("engine.io-client:polling");t.exports=r;var u=function(){var t=n(18),e=new t({xdomain:!1});return null!=e.responseType}();a(r,o),r.prototype.name="polling",r.prototype.doOpen=function(){this.poll()},r.prototype.pause=function(t){function e(){p("paused"),n.readyState="paused",t()}var n=this;if(this.readyState="pausing",this.polling||!this.writable){var r=0;this.polling&&(p("we are currently polling - waiting to pause"),r++,this.once("pollComplete",function(){p("pre-pause polling complete"),--r||e()})),this.writable||(p("we are currently writing - waiting to pause"),r++,this.once("drain",function(){p("pre-pause writing complete"),--r||e()}))}else e()},r.prototype.poll=function(){p("polling"),this.polling=!0,this.doPoll(),this.emit("poll")},r.prototype.onData=function(t){var e=this;p("polling got data %s",t);var n=function(t,n,r){return"opening"===e.readyState&&e.onOpen(),"close"===t.type?(e.onClose(),!1):void e.onPacket(t)};s.decodePayload(t,this.socket.binaryType,n),"closed"!==this.readyState&&(this.polling=!1,this.emit("pollComplete"),"open"===this.readyState?this.poll():p('ignoring poll - transport state "%s"',this.readyState))},r.prototype.doClose=function(){function t(){p("writing close packet"),e.write([{type:"close"}])}var e=this;"open"===this.readyState?(p("transport open - closing"),t()):(p("transport not open - deferring close"),this.once("open",t))},r.prototype.write=function(t){var e=this;this.writable=!1;var n=function(){e.writable=!0,e.emit("drain")};s.encodePayload(t,this.supportsBinary,function(t){e.doWrite(t,n)})},r.prototype.uri=function(){var t=this.query||{},e=this.secure?"https":"http",n="";!1!==this.timestampRequests&&(t[this.timestampParam]=c()),this.supportsBinary||t.sid||(t.b64=1),t=i.encode(t),this.port&&("https"===e&&443!==Number(this.port)||"http"===e&&80!==Number(this.port))&&(n=":"+this.port),t.length&&(t="?"+t);var r=this.hostname.indexOf(":")!==-1;return e+"://"+(r?"["+this.hostname+"]":this.hostname)+n+this.path+t}},function(t,e,n){function r(t){this.path=t.path,this.hostname=t.hostname,this.port=t.port,this.secure=t.secure,this.query=t.query,this.timestampParam=t.timestampParam,this.timestampRequests=t.timestampRequests,this.readyState="",this.agent=t.agent||!1,this.socket=t.socket,this.enablesXDR=t.enablesXDR,this.pfx=t.pfx,this.key=t.key,this.passphrase=t.passphrase,this.cert=t.cert,this.ca=t.ca,this.ciphers=t.ciphers,this.rejectUnauthorized=t.rejectUnauthorized,this.forceNode=t.forceNode,this.extraHeaders=t.extraHeaders,this.localAddress=t.localAddress}var o=n(23),i=n(8);t.exports=r,i(r.prototype),r.prototype.onError=function(t,e){var n=new Error(t);return n.type="TransportError",n.description=e,this.emit("error",n),this},r.prototype.open=function(){return"closed"!==this.readyState&&""!==this.readyState||(this.readyState="opening",this.doOpen()),this},r.prototype.close=function(){return"opening"!==this.readyState&&"open"!==this.readyState||(this.doClose(),this.onClose()),this},r.prototype.send=function(t){if("open"!==this.readyState)throw new Error("Transport not open");this.write(t)},r.prototype.onOpen=function(){this.readyState="open",this.writable=!0,this.emit("open")},r.prototype.onData=function(t){var e=o.decodePacket(t,this.socket.binaryType);this.onPacket(e)},r.prototype.onPacket=function(t){this.emit("packet",t)},r.prototype.onClose=function(){this.readyState="closed",this.emit("close")}},function(t,e,n){(function(t){function r(t,n){var r="b"+e.packets[t.type]+t.data.data;return n(r)}function o(t,n,r){if(!n)return e.encodeBase64Packet(t,r);var o=t.data,i=new Uint8Array(o),s=new Uint8Array(1+o.byteLength);s[0]=v[t.type];for(var a=0;a<i.length;a++)s[a+1]=i[a];return r(s.buffer)}function i(t,n,r){if(!n)return e.encodeBase64Packet(t,r);var o=new FileReader;return o.onload=function(){t.data=o.result,e.encodePacket(t,n,!0,r)},o.readAsArrayBuffer(t.data)}function s(t,n,r){if(!n)return e.encodeBase64Packet(t,r);if(g)return i(t,n,r);var o=new Uint8Array(1);o[0]=v[t.type];var s=new k([o.buffer,t.data]);return r(s)}function a(t){try{t=d.decode(t,{strict:!1})}catch(e){return!1}return t}function c(t,e,n){for(var r=new Array(t.length),o=l(t.length,n),i=function(t,n,o){e(n,function(e,n){r[t]=n,o(e,r)})},s=0;s<t.length;s++)i(s,t[s],o)}var p,u=n(24),h=n(9),f=n(25),l=n(26),d=n(27);t&&t.ArrayBuffer&&(p=n(29));var y="undefined"!=typeof navigator&&/Android/i.test(navigator.userAgent),m="undefined"!=typeof navigator&&/PhantomJS/i.test(navigator.userAgent),g=y||m;e.protocol=3;var v=e.packets={open:0,close:1,ping:2,pong:3,message:4,upgrade:5,noop:6},b=u(v),w={type:"error",data:"parser error"},k=n(30);e.encodePacket=function(e,n,i,a){"function"==typeof n&&(a=n,n=!1),"function"==typeof i&&(a=i,i=null);var c=void 0===e.data?void 0:e.data.buffer||e.data;if(t.ArrayBuffer&&c instanceof ArrayBuffer)return o(e,n,a);if(k&&c instanceof t.Blob)return s(e,n,a);if(c&&c.base64)return r(e,a);var p=v[e.type];return void 0!==e.data&&(p+=i?d.encode(String(e.data),{strict:!1}):String(e.data)),a(""+p)},e.encodeBase64Packet=function(n,r){var o="b"+e.packets[n.type];if(k&&n.data instanceof t.Blob){var i=new FileReader;return i.onload=function(){var t=i.result.split(",")[1];r(o+t)},i.readAsDataURL(n.data)}var s;try{s=String.fromCharCode.apply(null,new Uint8Array(n.data))}catch(a){for(var c=new Uint8Array(n.data),p=new Array(c.length),u=0;u<c.length;u++)p[u]=c[u];s=String.fromCharCode.apply(null,p)}return o+=t.btoa(s),r(o)},e.decodePacket=function(t,n,r){if(void 0===t)return w;if("string"==typeof t){if("b"===t.charAt(0))return e.decodeBase64Packet(t.substr(1),n);if(r&&(t=a(t),t===!1))return w;var o=t.charAt(0);return Number(o)==o&&b[o]?t.length>1?{type:b[o],data:t.substring(1)}:{type:b[o]}:w}var i=new Uint8Array(t),o=i[0],s=f(t,1);return k&&"blob"===n&&(s=new k([s])),{type:b[o],data:s}},e.decodeBase64Packet=function(t,e){var n=b[t.charAt(0)];if(!p)return{type:n,data:{base64:!0,data:t.substr(1)}};var r=p.decode(t.substr(1));return"blob"===e&&k&&(r=new k([r])),{type:n,data:r}},e.encodePayload=function(t,n,r){function o(t){return t.length+":"+t}function i(t,r){e.encodePacket(t,!!s&&n,!1,function(t){r(null,o(t))})}"function"==typeof n&&(r=n,n=null);var s=h(t);return n&&s?k&&!g?e.encodePayloadAsBlob(t,r):e.encodePayloadAsArrayBuffer(t,r):t.length?void c(t,i,function(t,e){return r(e.join(""))}):r("0:")},e.decodePayload=function(t,n,r){if("string"!=typeof t)return e.decodePayloadAsBinary(t,n,r);"function"==typeof n&&(r=n,n=null);var o;if(""===t)return r(w,0,1);for(var i,s,a="",c=0,p=t.length;c<p;c++){var u=t.charAt(c);if(":"===u){if(""===a||a!=(i=Number(a)))return r(w,0,1);if(s=t.substr(c+1,i),a!=s.length)return r(w,0,1);if(s.length){if(o=e.decodePacket(s,n,!1),w.type===o.type&&w.data===o.data)return r(w,0,1);var h=r(o,c+i,p);if(!1===h)return}c+=i,a=""}else a+=u}return""!==a?r(w,0,1):void 0},e.encodePayloadAsArrayBuffer=function(t,n){function r(t,n){e.encodePacket(t,!0,!0,function(t){return n(null,t)})}return t.length?void c(t,r,function(t,e){var r=e.reduce(function(t,e){var n;return n="string"==typeof e?e.length:e.byteLength,t+n.toString().length+n+2},0),o=new Uint8Array(r),i=0;return e.forEach(function(t){var e="string"==typeof t,n=t;if(e){for(var r=new Uint8Array(t.length),s=0;s<t.length;s++)r[s]=t.charCodeAt(s);n=r.buffer}e?o[i++]=0:o[i++]=1;for(var a=n.byteLength.toString(),s=0;s<a.length;s++)o[i++]=parseInt(a[s]);o[i++]=255;for(var r=new Uint8Array(n),s=0;s<r.length;s++)o[i++]=r[s]}),n(o.buffer)}):n(new ArrayBuffer(0))},e.encodePayloadAsBlob=function(t,n){function r(t,n){e.encodePacket(t,!0,!0,function(t){var e=new Uint8Array(1);if(e[0]=1,"string"==typeof t){for(var r=new Uint8Array(t.length),o=0;o<t.length;o++)r[o]=t.charCodeAt(o);t=r.buffer,e[0]=0}for(var i=t instanceof ArrayBuffer?t.byteLength:t.size,s=i.toString(),a=new Uint8Array(s.length+1),o=0;o<s.length;o++)a[o]=parseInt(s[o]);if(a[s.length]=255,k){var c=new k([e.buffer,a.buffer,t]);n(null,c)}})}c(t,r,function(t,e){return n(new k(e))})},e.decodePayloadAsBinary=function(t,n,r){"function"==typeof n&&(r=n,n=null);for(var o=t,i=[];o.byteLength>0;){for(var s=new Uint8Array(o),a=0===s[0],c="",p=1;255!==s[p];p++){if(c.length>310)return r(w,0,1);c+=s[p]}o=f(o,2+c.length),c=parseInt(c);var u=f(o,0,c);if(a)try{u=String.fromCharCode.apply(null,new Uint8Array(u))}catch(h){var l=new Uint8Array(u);u="";for(var p=0;p<l.length;p++)u+=String.fromCharCode(l[p])}i.push(u),o=f(o,c)}var d=i.length;i.forEach(function(t,o){r(e.decodePacket(t,n,!0),o,d)})}}).call(e,function(){return this}())},function(t,e){t.exports=Object.keys||function(t){var e=[],n=Object.prototype.hasOwnProperty;for(var r in t)n.call(t,r)&&e.push(r);return e}},function(t,e){t.exports=function(t,e,n){var r=t.byteLength;if(e=e||0,n=n||r,t.slice)return t.slice(e,n);if(e<0&&(e+=r),n<0&&(n+=r),n>r&&(n=r),e>=r||e>=n||0===r)return new ArrayBuffer(0);for(var o=new Uint8Array(t),i=new Uint8Array(n-e),s=e,a=0;s<n;s++,a++)i[a]=o[s];return i.buffer}},function(t,e){function n(t,e,n){function o(t,r){if(o.count<=0)throw new Error("after called too many times");--o.count,t?(i=!0,e(t),e=n):0!==o.count||i||e(null,r)}var i=!1;return n=n||r,o.count=t,0===t?e():o}function r(){}t.exports=n},function(t,e,n){var r;(function(t,o){!function(i){function s(t){for(var e,n,r=[],o=0,i=t.length;o<i;)e=t.charCodeAt(o++),e>=55296&&e<=56319&&o<i?(n=t.charCodeAt(o++),56320==(64512&n)?r.push(((1023&e)<<10)+(1023&n)+65536):(r.push(e),o--)):r.push(e);return r}function a(t){for(var e,n=t.length,r=-1,o="";++r<n;)e=t[r],e>65535&&(e-=65536,o+=w(e>>>10&1023|55296),e=56320|1023&e),o+=w(e);return o}function c(t,e){if(t>=55296&&t<=57343){if(e)throw Error("Lone surrogate U+"+t.toString(16).toUpperCase()+" is not a scalar value");return!1}return!0}function p(t,e){return w(t>>e&63|128)}function u(t,e){if(0==(4294967168&t))return w(t);var n="";return 0==(4294965248&t)?n=w(t>>6&31|192):0==(4294901760&t)?(c(t,e)||(t=65533),n=w(t>>12&15|224),n+=p(t,6)):0==(4292870144&t)&&(n=w(t>>18&7|240),n+=p(t,12),n+=p(t,6)),n+=w(63&t|128)}function h(t,e){e=e||{};for(var n,r=!1!==e.strict,o=s(t),i=o.length,a=-1,c="";++a<i;)n=o[a],c+=u(n,r);return c}function f(){if(b>=v)throw Error("Invalid byte index");var t=255&g[b];if(b++,128==(192&t))return 63&t;throw Error("Invalid continuation byte")}function l(t){var e,n,r,o,i;if(b>v)throw Error("Invalid byte index");if(b==v)return!1;if(e=255&g[b],b++,0==(128&e))return e;if(192==(224&e)){if(n=f(),i=(31&e)<<6|n,i>=128)return i;throw Error("Invalid continuation byte")}if(224==(240&e)){if(n=f(),r=f(),i=(15&e)<<12|n<<6|r,i>=2048)return c(i,t)?i:65533;throw Error("Invalid continuation byte")}if(240==(248&e)&&(n=f(),r=f(),o=f(),i=(7&e)<<18|n<<12|r<<6|o,i>=65536&&i<=1114111))return i;throw Error("Invalid UTF-8 detected")}function d(t,e){e=e||{};var n=!1!==e.strict;g=s(t),v=g.length,b=0;for(var r,o=[];(r=l(n))!==!1;)o.push(r);return a(o)}var y="object"==typeof e&&e,m=("object"==typeof t&&t&&t.exports==y&&t,"object"==typeof o&&o);m.global!==m&&m.window!==m||(i=m);var g,v,b,w=String.fromCharCode,k={version:"2.1.2",encode:h,decode:d};r=function(){return k}.call(e,n,e,t),!(void 0!==r&&(t.exports=r))}(this)}).call(e,n(28)(t),function(){return this}())},function(t,e){t.exports=function(t){return t.webpackPolyfill||(t.deprecate=function(){},t.paths=[],t.children=[],t.webpackPolyfill=1),t}},function(t,e){!function(){"use strict";for(var t="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",n=new Uint8Array(256),r=0;r<t.length;r++)n[t.charCodeAt(r)]=r;e.encode=function(e){var n,r=new Uint8Array(e),o=r.length,i="";for(n=0;n<o;n+=3)i+=t[r[n]>>2],i+=t[(3&r[n])<<4|r[n+1]>>4],i+=t[(15&r[n+1])<<2|r[n+2]>>6],i+=t[63&r[n+2]];return o%3===2?i=i.substring(0,i.length-1)+"=":o%3===1&&(i=i.substring(0,i.length-2)+"=="),i},e.decode=function(t){var e,r,o,i,s,a=.75*t.length,c=t.length,p=0;"="===t[t.length-1]&&(a--,"="===t[t.length-2]&&a--);var u=new ArrayBuffer(a),h=new Uint8Array(u);for(e=0;e<c;e+=4)r=n[t.charCodeAt(e)],o=n[t.charCodeAt(e+1)],i=n[t.charCodeAt(e+2)],s=n[t.charCodeAt(e+3)],h[p++]=r<<2|o>>4,h[p++]=(15&o)<<4|i>>2,h[p++]=(3&i)<<6|63&s;return u}}()},function(t,e){(function(e){function n(t){for(var e=0;e<t.length;e++){var n=t[e];if(n.buffer instanceof ArrayBuffer){var r=n.buffer;if(n.byteLength!==r.byteLength){var o=new Uint8Array(n.byteLength);o.set(new Uint8Array(r,n.byteOffset,n.byteLength)),r=o.buffer}t[e]=r}}}function r(t,e){e=e||{};var r=new i;n(t);for(var o=0;o<t.length;o++)r.append(t[o]);return e.type?r.getBlob(e.type):r.getBlob()}function o(t,e){return n(t),new Blob(t,e||{})}var i=e.BlobBuilder||e.WebKitBlobBuilder||e.MSBlobBuilder||e.MozBlobBuilder,s=function(){try{var t=new Blob(["hi"]);return 2===t.size}catch(e){return!1}}(),a=s&&function(){try{var t=new Blob([new Uint8Array([1,2])]);return 2===t.size}catch(e){return!1}}(),c=i&&i.prototype.append&&i.prototype.getBlob;t.exports=function(){return s?a?e.Blob:o:c?r:void 0}()}).call(e,function(){return this}())},function(t,e){e.encode=function(t){var e="";for(var n in t)t.hasOwnProperty(n)&&(e.length&&(e+="&"),e+=encodeURIComponent(n)+"="+encodeURIComponent(t[n]));return e},e.decode=function(t){for(var e={},n=t.split("&"),r=0,o=n.length;r<o;r++){var i=n[r].split("=");e[decodeURIComponent(i[0])]=decodeURIComponent(i[1])}return e}},function(t,e){t.exports=function(t,e){var n=function(){};n.prototype=e.prototype,t.prototype=new n,t.prototype.constructor=t}},function(t,e){"use strict";function n(t){var e="";do e=s[t%a]+e,t=Math.floor(t/a);while(t>0);return e}function r(t){var e=0;for(u=0;u<t.length;u++)e=e*a+c[t.charAt(u)];return e}function o(){var t=n(+new Date);return t!==i?(p=0,i=t):t+"."+n(p++)}for(var i,s="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split(""),a=64,c={},p=0,u=0;u<a;u++)c[s[u]]=u;o.encode=n,o.decode=r,t.exports=o},function(t,e,n){(function(e){function r(){}function o(t){i.call(this,t),this.query=this.query||{},a||(e.___eio||(e.___eio=[]),a=e.___eio),this.index=a.length;var n=this;a.push(function(t){n.onData(t)}),this.query.j=this.index,e.document&&e.addEventListener&&e.addEventListener("beforeunload",function(){n.script&&(n.script.onerror=r)},!1)}var i=n(21),s=n(32);t.exports=o;var a,c=/\n/g,p=/\\n/g;s(o,i),o.prototype.supportsBinary=!1,o.prototype.doClose=function(){this.script&&(this.script.parentNode.removeChild(this.script),this.script=null),this.form&&(this.form.parentNode.removeChild(this.form),this.form=null,this.iframe=null),i.prototype.doClose.call(this)},o.prototype.doPoll=function(){var t=this,e=document.createElement("script");this.script&&(this.script.parentNode.removeChild(this.script),this.script=null),e.async=!0,e.src=this.uri(),e.onerror=function(e){t.onError("jsonp poll error",e)};var n=document.getElementsByTagName("script")[0];n?n.parentNode.insertBefore(e,n):(document.head||document.body).appendChild(e),this.script=e;var r="undefined"!=typeof navigator&&/gecko/i.test(navigator.userAgent);r&&setTimeout(function(){var t=document.createElement("iframe");document.body.appendChild(t),document.body.removeChild(t)},100)},o.prototype.doWrite=function(t,e){function n(){r(),e()}function r(){if(o.iframe)try{o.form.removeChild(o.iframe)}catch(t){o.onError("jsonp polling iframe removal error",t)}try{var e='<iframe src="javascript:0" name="'+o.iframeId+'">';i=document.createElement(e)}catch(t){i=document.createElement("iframe"),i.name=o.iframeId,i.src="javascript:0"}i.id=o.iframeId,o.form.appendChild(i),o.iframe=i}var o=this;if(!this.form){var i,s=document.createElement("form"),a=document.createElement("textarea"),u=this.iframeId="eio_iframe_"+this.index;s.className="socketio",s.style.position="absolute",s.style.top="-1000px",s.style.left="-1000px",s.target=u,s.method="POST",s.setAttribute("accept-charset","utf-8"),a.name="d",s.appendChild(a),document.body.appendChild(s),this.form=s,this.area=a}this.form.action=this.uri(),r(),t=t.replace(p,"\\\n"),this.area.value=t.replace(c,"\\n");try{this.form.submit()}catch(h){}this.iframe.attachEvent?this.iframe.onreadystatechange=function(){"complete"===o.iframe.readyState&&n()}:this.iframe.onload=n}}).call(e,function(){return this}())},function(t,e,n){(function(e){function r(t){var e=t&&t.forceBase64;e&&(this.supportsBinary=!1),this.perMessageDeflate=t.perMessageDeflate,this.usingBrowserWebSocket=h&&!t.forceNode,this.protocols=t.protocols,this.usingBrowserWebSocket||(l=o),i.call(this,t)}var o,i=n(22),s=n(23),a=n(31),c=n(32),p=n(33),u=n(3)("engine.io-client:websocket"),h=e.WebSocket||e.MozWebSocket;if("undefined"==typeof window)try{o=n(36)}catch(f){}var l=h;l||"undefined"!=typeof window||(l=o),t.exports=r,c(r,i),r.prototype.name="websocket",r.prototype.supportsBinary=!0,r.prototype.doOpen=function(){if(this.check()){var t=this.uri(),e=this.protocols,n={agent:this.agent,perMessageDeflate:this.perMessageDeflate};n.pfx=this.pfx,n.key=this.key,n.passphrase=this.passphrase,n.cert=this.cert,n.ca=this.ca,n.ciphers=this.ciphers,n.rejectUnauthorized=this.rejectUnauthorized,this.extraHeaders&&(n.headers=this.extraHeaders),this.localAddress&&(n.localAddress=this.localAddress);try{this.ws=this.usingBrowserWebSocket?e?new l(t,e):new l(t):new l(t,e,n)}catch(r){return this.emit("error",r)}void 0===this.ws.binaryType&&(this.supportsBinary=!1),this.ws.supports&&this.ws.supports.binary?(this.supportsBinary=!0,this.ws.binaryType="nodebuffer"):this.ws.binaryType="arraybuffer",this.addEventListeners()}},r.prototype.addEventListeners=function(){var t=this;this.ws.onopen=function(){t.onOpen()},this.ws.onclose=function(){t.onClose()},this.ws.onmessage=function(e){t.onData(e.data)},this.ws.onerror=function(e){t.onError("websocket error",e)}},r.prototype.write=function(t){function n(){r.emit("flush"),setTimeout(function(){r.writable=!0,r.emit("drain")},0)}var r=this;this.writable=!1;for(var o=t.length,i=0,a=o;i<a;i++)!function(t){s.encodePacket(t,r.supportsBinary,function(i){if(!r.usingBrowserWebSocket){var s={};if(t.options&&(s.compress=t.options.compress),r.perMessageDeflate){var a="string"==typeof i?e.Buffer.byteLength(i):i.length;a<r.perMessageDeflate.threshold&&(s.compress=!1)}}try{r.usingBrowserWebSocket?r.ws.send(i):r.ws.send(i,s)}catch(c){u("websocket closed before onclose event")}--o||n()})}(t[i])},r.prototype.onClose=function(){i.prototype.onClose.call(this)},r.prototype.doClose=function(){"undefined"!=typeof this.ws&&this.ws.close()},r.prototype.uri=function(){var t=this.query||{},e=this.secure?"wss":"ws",n="";this.port&&("wss"===e&&443!==Number(this.port)||"ws"===e&&80!==Number(this.port))&&(n=":"+this.port),this.timestampRequests&&(t[this.timestampParam]=p()),this.supportsBinary||(t.b64=1),t=a.encode(t),t.length&&(t="?"+t);var r=this.hostname.indexOf(":")!==-1;return e+"://"+(r?"["+this.hostname+"]":this.hostname)+n+this.path+t},r.prototype.check=function(){return!(!l||"__initialize"in l&&this.name===r.prototype.name)}}).call(e,function(){return this}())},function(t,e){},function(t,e){var n=[].indexOf;t.exports=function(t,e){if(n)return t.indexOf(e);for(var r=0;r<t.length;++r)if(t[r]===e)return r;return-1}},function(t,e){(function(e){var n=/^[\],:{}\s]*$/,r=/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,o=/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,i=/(?:^|:|,)(?:\s*\[)+/g,s=/^\s+/,a=/\s+$/;t.exports=function(t){return"string"==typeof t&&t?(t=t.replace(s,"").replace(a,""),e.JSON&&JSON.parse?JSON.parse(t):n.test(t.replace(r,"@").replace(o,"]").replace(i,""))?new Function("return "+t)():void 0):null}}).call(e,function(){return this}())},function(t,e,n){"use strict";function r(t,e,n){this.io=t,this.nsp=e,this.json=this,this.ids=0,this.acks={},this.receiveBuffer=[],this.sendBuffer=[],this.connected=!1,this.disconnected=!0,n&&n.query&&(this.query=n.query),this.io.autoConnect&&this.open()}var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},i=n(7),s=n(8),a=n(40),c=n(41),p=n(42),u=n(3)("socket.io-client:socket"),h=n(31);t.exports=e=r;var f={connect:1,connect_error:1,connect_timeout:1,connecting:1,disconnect:1,error:1,reconnect:1,reconnect_attempt:1,reconnect_failed:1,reconnect_error:1,reconnecting:1,ping:1,pong:1},l=s.prototype.emit;s(r.prototype),r.prototype.subEvents=function(){if(!this.subs){var t=this.io;this.subs=[c(t,"open",p(this,"onopen")),c(t,"packet",p(this,"onpacket")),c(t,"close",p(this,"onclose"))]}},r.prototype.open=r.prototype.connect=function(){return this.connected?this:(this.subEvents(),this.io.open(),"open"===this.io.readyState&&this.onopen(),this.emit("connecting"),this)},r.prototype.send=function(){var t=a(arguments);return t.unshift("message"),this.emit.apply(this,t),this},r.prototype.emit=function(t){if(f.hasOwnProperty(t))return l.apply(this,arguments),this;var e=a(arguments),n={type:i.EVENT,data:e};return n.options={},n.options.compress=!this.flags||!1!==this.flags.compress,"function"==typeof e[e.length-1]&&(u("emitting packet with ack id %d",this.ids),this.acks[this.ids]=e.pop(),n.id=this.ids++),this.connected?this.packet(n):this.sendBuffer.push(n),delete this.flags,this},r.prototype.packet=function(t){t.nsp=this.nsp,this.io.packet(t)},r.prototype.onopen=function(){if(u("transport is open - connecting"),"/"!==this.nsp)if(this.query){var t="object"===o(this.query)?h.encode(this.query):this.query;u("sending connect packet with query %s",t),this.packet({type:i.CONNECT,query:t})}else this.packet({type:i.CONNECT})},r.prototype.onclose=function(t){u("close (%s)",t),this.connected=!1,this.disconnected=!0,delete this.id,this.emit("disconnect",t)},r.prototype.onpacket=function(t){if(t.nsp===this.nsp)switch(t.type){case i.CONNECT:this.onconnect();break;case i.EVENT:this.onevent(t);break;case i.BINARY_EVENT:this.onevent(t);break;case i.ACK:this.onack(t);break;case i.BINARY_ACK:this.onack(t);break;case i.DISCONNECT:this.ondisconnect();break;case i.ERROR:this.emit("error",t.data)}},r.prototype.onevent=function(t){var e=t.data||[];u("emitting event %j",e),null!=t.id&&(u("attaching ack callback to event"),e.push(this.ack(t.id))),this.connected?l.apply(this,e):this.receiveBuffer.push(e)},r.prototype.ack=function(t){var e=this,n=!1;return function(){if(!n){n=!0;var r=a(arguments);u("sending ack %j",r),e.packet({type:i.ACK,id:t,data:r})}}},r.prototype.onack=function(t){var e=this.acks[t.id];"function"==typeof e?(u("calling ack %s with %j",t.id,t.data),e.apply(this,t.data),delete this.acks[t.id]):u("bad ack %s",t.id)},r.prototype.onconnect=function(){this.connected=!0,this.disconnected=!1,this.emit("connect"),this.emitBuffered()},r.prototype.emitBuffered=function(){var t;for(t=0;t<this.receiveBuffer.length;t++)l.apply(this,this.receiveBuffer[t]);for(this.receiveBuffer=[],t=0;t<this.sendBuffer.length;t++)this.packet(this.sendBuffer[t]);this.sendBuffer=[]},r.prototype.ondisconnect=function(){u("server disconnect (%s)",this.nsp),this.destroy(),this.onclose("io server disconnect")},r.prototype.destroy=function(){if(this.subs){for(var t=0;t<this.subs.length;t++)this.subs[t].destroy();this.subs=null}this.io.destroy(this)},r.prototype.close=r.prototype.disconnect=function(){return this.connected&&(u("performing disconnect (%s)",this.nsp),this.packet({type:i.DISCONNECT})),this.destroy(),this.connected&&this.onclose("io client disconnect"),this},r.prototype.compress=function(t){return this.flags=this.flags||{},this.flags.compress=t,this}},function(t,e){function n(t,e){var n=[];e=e||0;for(var r=e||0;r<t.length;r++)n[r-e]=t[r];return n}t.exports=n},function(t,e){"use strict";function n(t,e,n){return t.on(e,n),{destroy:function(){t.removeListener(e,n)}}}t.exports=n},function(t,e){var n=[].slice;t.exports=function(t,e){if("string"==typeof e&&(e=t[e]),"function"!=typeof e)throw new Error("bind() requires a function");var r=n.call(arguments,2);return function(){return e.apply(t,r.concat(n.call(arguments)))}}},function(t,e){function n(t){t=t||{},this.ms=t.min||100,this.max=t.max||1e4,this.factor=t.factor||2,this.jitter=t.jitter>0&&t.jitter<=1?t.jitter:0,this.attempts=0}t.exports=n,n.prototype.duration=function(){var t=this.ms*Math.pow(this.factor,this.attempts++);if(this.jitter){var e=Math.random(),n=Math.floor(e*this.jitter*t);t=0==(1&Math.floor(10*e))?t-n:t+n}return 0|Math.min(t,this.max)},n.prototype.reset=function(){this.attempts=0},n.prototype.setMin=function(t){this.ms=t},n.prototype.setMax=function(t){this.max=t},n.prototype.setJitter=function(t){this.jitter=t}}])});

},{}],16:[function(require,module,exports){
module.exports = {
    randomId: function () {
        return (Math.random().toString(36) + '0000000000000000000').substr(2, 16);
    },
    extend: function(dest, source) {
        source = source || {};
        for(var key in source) {
            if(source.hasOwnProperty(key)) {
                dest[key] = source[key];
            }
        }
        return dest;
    },
    randOptions:function (options){
        return options[Math.floor(Math.random() * options.length)];
    }

}
},{}]},{},[14])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIm5vZGVfbW9kdWxlcy9qcy1iaW5hcnlwYWNrL2xpYi9iaW5hcnlwYWNrLmpzIiwibm9kZV9tb2R1bGVzL2pzLWJpbmFyeXBhY2svbGliL2J1ZmZlcmJ1aWxkZXIuanMiLCJub2RlX21vZHVsZXMvcGVlcmpzL2xpYi9hZGFwdGVyLmpzIiwibm9kZV9tb2R1bGVzL3BlZXJqcy9saWIvZGF0YWNvbm5lY3Rpb24uanMiLCJub2RlX21vZHVsZXMvcGVlcmpzL2xpYi9tZWRpYWNvbm5lY3Rpb24uanMiLCJub2RlX21vZHVsZXMvcGVlcmpzL2xpYi9uZWdvdGlhdG9yLmpzIiwibm9kZV9tb2R1bGVzL3BlZXJqcy9saWIvcGVlci5qcyIsIm5vZGVfbW9kdWxlcy9wZWVyanMvbGliL3NvY2tldC5qcyIsIm5vZGVfbW9kdWxlcy9wZWVyanMvbGliL3V0aWwuanMiLCJub2RlX21vZHVsZXMvcGVlcmpzL25vZGVfbW9kdWxlcy9ldmVudGVtaXR0ZXIzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3JlbGlhYmxlL2xpYi9yZWxpYWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9yZWxpYWJsZS9saWIvdXRpbC5qcyIsIm5vZGVfbW9kdWxlcy9zaWduYWxzL2Rpc3Qvc2lnbmFscy5qcyIsInNyYy9jbGllbnQvTG9iYnkuanMiLCJzcmMvY2xpZW50L3NvY2tldC5pby5qcyIsInNyYy91dGlsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdmdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ROQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDck9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOU9BO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIEJ1ZmZlckJ1aWxkZXIgPSByZXF1aXJlKCcuL2J1ZmZlcmJ1aWxkZXInKS5CdWZmZXJCdWlsZGVyO1xyXG52YXIgYmluYXJ5RmVhdHVyZXMgPSByZXF1aXJlKCcuL2J1ZmZlcmJ1aWxkZXInKS5iaW5hcnlGZWF0dXJlcztcclxuXHJcbnZhciBCaW5hcnlQYWNrID0ge1xyXG4gIHVucGFjazogZnVuY3Rpb24oZGF0YSl7XHJcbiAgICB2YXIgdW5wYWNrZXIgPSBuZXcgVW5wYWNrZXIoZGF0YSk7XHJcbiAgICByZXR1cm4gdW5wYWNrZXIudW5wYWNrKCk7XHJcbiAgfSxcclxuICBwYWNrOiBmdW5jdGlvbihkYXRhKXtcclxuICAgIHZhciBwYWNrZXIgPSBuZXcgUGFja2VyKCk7XHJcbiAgICBwYWNrZXIucGFjayhkYXRhKTtcclxuICAgIHZhciBidWZmZXIgPSBwYWNrZXIuZ2V0QnVmZmVyKCk7XHJcbiAgICByZXR1cm4gYnVmZmVyO1xyXG4gIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQmluYXJ5UGFjaztcclxuXHJcbmZ1bmN0aW9uIFVucGFja2VyIChkYXRhKXtcclxuICAvLyBEYXRhIGlzIEFycmF5QnVmZmVyXHJcbiAgdGhpcy5pbmRleCA9IDA7XHJcbiAgdGhpcy5kYXRhQnVmZmVyID0gZGF0YTtcclxuICB0aGlzLmRhdGFWaWV3ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5kYXRhQnVmZmVyKTtcclxuICB0aGlzLmxlbmd0aCA9IHRoaXMuZGF0YUJ1ZmZlci5ieXRlTGVuZ3RoO1xyXG59XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrID0gZnVuY3Rpb24oKXtcclxuICB2YXIgdHlwZSA9IHRoaXMudW5wYWNrX3VpbnQ4KCk7XHJcbiAgaWYgKHR5cGUgPCAweDgwKXtcclxuICAgIHZhciBwb3NpdGl2ZV9maXhudW0gPSB0eXBlO1xyXG4gICAgcmV0dXJuIHBvc2l0aXZlX2ZpeG51bTtcclxuICB9IGVsc2UgaWYgKCh0eXBlIF4gMHhlMCkgPCAweDIwKXtcclxuICAgIHZhciBuZWdhdGl2ZV9maXhudW0gPSAodHlwZSBeIDB4ZTApIC0gMHgyMDtcclxuICAgIHJldHVybiBuZWdhdGl2ZV9maXhudW07XHJcbiAgfVxyXG4gIHZhciBzaXplO1xyXG4gIGlmICgoc2l6ZSA9IHR5cGUgXiAweGEwKSA8PSAweDBmKXtcclxuICAgIHJldHVybiB0aGlzLnVucGFja19yYXcoc2l6ZSk7XHJcbiAgfSBlbHNlIGlmICgoc2l6ZSA9IHR5cGUgXiAweGIwKSA8PSAweDBmKXtcclxuICAgIHJldHVybiB0aGlzLnVucGFja19zdHJpbmcoc2l6ZSk7XHJcbiAgfSBlbHNlIGlmICgoc2l6ZSA9IHR5cGUgXiAweDkwKSA8PSAweDBmKXtcclxuICAgIHJldHVybiB0aGlzLnVucGFja19hcnJheShzaXplKTtcclxuICB9IGVsc2UgaWYgKChzaXplID0gdHlwZSBeIDB4ODApIDw9IDB4MGYpe1xyXG4gICAgcmV0dXJuIHRoaXMudW5wYWNrX21hcChzaXplKTtcclxuICB9XHJcbiAgc3dpdGNoKHR5cGUpe1xyXG4gICAgY2FzZSAweGMwOlxyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIGNhc2UgMHhjMTpcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGNhc2UgMHhjMjpcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgY2FzZSAweGMzOlxyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIGNhc2UgMHhjYTpcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX2Zsb2F0KCk7XHJcbiAgICBjYXNlIDB4Y2I6XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja19kb3VibGUoKTtcclxuICAgIGNhc2UgMHhjYzpcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX3VpbnQ4KCk7XHJcbiAgICBjYXNlIDB4Y2Q6XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja191aW50MTYoKTtcclxuICAgIGNhc2UgMHhjZTpcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX3VpbnQzMigpO1xyXG4gICAgY2FzZSAweGNmOlxyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfdWludDY0KCk7XHJcbiAgICBjYXNlIDB4ZDA6XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja19pbnQ4KCk7XHJcbiAgICBjYXNlIDB4ZDE6XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja19pbnQxNigpO1xyXG4gICAgY2FzZSAweGQyOlxyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfaW50MzIoKTtcclxuICAgIGNhc2UgMHhkMzpcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX2ludDY0KCk7XHJcbiAgICBjYXNlIDB4ZDQ6XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjYXNlIDB4ZDU6XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjYXNlIDB4ZDY6XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjYXNlIDB4ZDc6XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjYXNlIDB4ZDg6XHJcbiAgICAgIHNpemUgPSB0aGlzLnVucGFja191aW50MTYoKTtcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX3N0cmluZyhzaXplKTtcclxuICAgIGNhc2UgMHhkOTpcclxuICAgICAgc2l6ZSA9IHRoaXMudW5wYWNrX3VpbnQzMigpO1xyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfc3RyaW5nKHNpemUpO1xyXG4gICAgY2FzZSAweGRhOlxyXG4gICAgICBzaXplID0gdGhpcy51bnBhY2tfdWludDE2KCk7XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja19yYXcoc2l6ZSk7XHJcbiAgICBjYXNlIDB4ZGI6XHJcbiAgICAgIHNpemUgPSB0aGlzLnVucGFja191aW50MzIoKTtcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX3JhdyhzaXplKTtcclxuICAgIGNhc2UgMHhkYzpcclxuICAgICAgc2l6ZSA9IHRoaXMudW5wYWNrX3VpbnQxNigpO1xyXG4gICAgICByZXR1cm4gdGhpcy51bnBhY2tfYXJyYXkoc2l6ZSk7XHJcbiAgICBjYXNlIDB4ZGQ6XHJcbiAgICAgIHNpemUgPSB0aGlzLnVucGFja191aW50MzIoKTtcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX2FycmF5KHNpemUpO1xyXG4gICAgY2FzZSAweGRlOlxyXG4gICAgICBzaXplID0gdGhpcy51bnBhY2tfdWludDE2KCk7XHJcbiAgICAgIHJldHVybiB0aGlzLnVucGFja19tYXAoc2l6ZSk7XHJcbiAgICBjYXNlIDB4ZGY6XHJcbiAgICAgIHNpemUgPSB0aGlzLnVucGFja191aW50MzIoKTtcclxuICAgICAgcmV0dXJuIHRoaXMudW5wYWNrX21hcChzaXplKTtcclxuICB9XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfdWludDggPSBmdW5jdGlvbigpe1xyXG4gIHZhciBieXRlID0gdGhpcy5kYXRhVmlld1t0aGlzLmluZGV4XSAmIDB4ZmY7XHJcbiAgdGhpcy5pbmRleCsrO1xyXG4gIHJldHVybiBieXRlO1xyXG59O1xyXG5cclxuVW5wYWNrZXIucHJvdG90eXBlLnVucGFja191aW50MTYgPSBmdW5jdGlvbigpe1xyXG4gIHZhciBieXRlcyA9IHRoaXMucmVhZCgyKTtcclxuICB2YXIgdWludDE2ID1cclxuICAgICgoYnl0ZXNbMF0gJiAweGZmKSAqIDI1NikgKyAoYnl0ZXNbMV0gJiAweGZmKTtcclxuICB0aGlzLmluZGV4ICs9IDI7XHJcbiAgcmV0dXJuIHVpbnQxNjtcclxufVxyXG5cclxuVW5wYWNrZXIucHJvdG90eXBlLnVucGFja191aW50MzIgPSBmdW5jdGlvbigpe1xyXG4gIHZhciBieXRlcyA9IHRoaXMucmVhZCg0KTtcclxuICB2YXIgdWludDMyID1cclxuICAgICAoKGJ5dGVzWzBdICAqIDI1NiArXHJcbiAgICAgICBieXRlc1sxXSkgKiAyNTYgK1xyXG4gICAgICAgYnl0ZXNbMl0pICogMjU2ICtcclxuICAgICAgIGJ5dGVzWzNdO1xyXG4gIHRoaXMuaW5kZXggKz0gNDtcclxuICByZXR1cm4gdWludDMyO1xyXG59XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX3VpbnQ2NCA9IGZ1bmN0aW9uKCl7XHJcbiAgdmFyIGJ5dGVzID0gdGhpcy5yZWFkKDgpO1xyXG4gIHZhciB1aW50NjQgPVxyXG4gICAoKCgoKChieXRlc1swXSAgKiAyNTYgK1xyXG4gICAgICAgYnl0ZXNbMV0pICogMjU2ICtcclxuICAgICAgIGJ5dGVzWzJdKSAqIDI1NiArXHJcbiAgICAgICBieXRlc1szXSkgKiAyNTYgK1xyXG4gICAgICAgYnl0ZXNbNF0pICogMjU2ICtcclxuICAgICAgIGJ5dGVzWzVdKSAqIDI1NiArXHJcbiAgICAgICBieXRlc1s2XSkgKiAyNTYgK1xyXG4gICAgICAgYnl0ZXNbN107XHJcbiAgdGhpcy5pbmRleCArPSA4O1xyXG4gIHJldHVybiB1aW50NjQ7XHJcbn1cclxuXHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX2ludDggPSBmdW5jdGlvbigpe1xyXG4gIHZhciB1aW50OCA9IHRoaXMudW5wYWNrX3VpbnQ4KCk7XHJcbiAgcmV0dXJuICh1aW50OCA8IDB4ODAgKSA/IHVpbnQ4IDogdWludDggLSAoMSA8PCA4KTtcclxufTtcclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfaW50MTYgPSBmdW5jdGlvbigpe1xyXG4gIHZhciB1aW50MTYgPSB0aGlzLnVucGFja191aW50MTYoKTtcclxuICByZXR1cm4gKHVpbnQxNiA8IDB4ODAwMCApID8gdWludDE2IDogdWludDE2IC0gKDEgPDwgMTYpO1xyXG59XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX2ludDMyID0gZnVuY3Rpb24oKXtcclxuICB2YXIgdWludDMyID0gdGhpcy51bnBhY2tfdWludDMyKCk7XHJcbiAgcmV0dXJuICh1aW50MzIgPCBNYXRoLnBvdygyLCAzMSkgKSA/IHVpbnQzMiA6XHJcbiAgICB1aW50MzIgLSBNYXRoLnBvdygyLCAzMik7XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfaW50NjQgPSBmdW5jdGlvbigpe1xyXG4gIHZhciB1aW50NjQgPSB0aGlzLnVucGFja191aW50NjQoKTtcclxuICByZXR1cm4gKHVpbnQ2NCA8IE1hdGgucG93KDIsIDYzKSApID8gdWludDY0IDpcclxuICAgIHVpbnQ2NCAtIE1hdGgucG93KDIsIDY0KTtcclxufVxyXG5cclxuVW5wYWNrZXIucHJvdG90eXBlLnVucGFja19yYXcgPSBmdW5jdGlvbihzaXplKXtcclxuICBpZiAoIHRoaXMubGVuZ3RoIDwgdGhpcy5pbmRleCArIHNpemUpe1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdCaW5hcnlQYWNrRmFpbHVyZTogaW5kZXggaXMgb3V0IG9mIHJhbmdlJ1xyXG4gICAgICArICcgJyArIHRoaXMuaW5kZXggKyAnICcgKyBzaXplICsgJyAnICsgdGhpcy5sZW5ndGgpO1xyXG4gIH1cclxuICB2YXIgYnVmID0gdGhpcy5kYXRhQnVmZmVyLnNsaWNlKHRoaXMuaW5kZXgsIHRoaXMuaW5kZXggKyBzaXplKTtcclxuICB0aGlzLmluZGV4ICs9IHNpemU7XHJcblxyXG4gICAgLy9idWYgPSB1dGlsLmJ1ZmZlclRvU3RyaW5nKGJ1Zik7XHJcblxyXG4gIHJldHVybiBidWY7XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS51bnBhY2tfc3RyaW5nID0gZnVuY3Rpb24oc2l6ZSl7XHJcbiAgdmFyIGJ5dGVzID0gdGhpcy5yZWFkKHNpemUpO1xyXG4gIHZhciBpID0gMCwgc3RyID0gJycsIGMsIGNvZGU7XHJcbiAgd2hpbGUoaSA8IHNpemUpe1xyXG4gICAgYyA9IGJ5dGVzW2ldO1xyXG4gICAgaWYgKCBjIDwgMTI4KXtcclxuICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYyk7XHJcbiAgICAgIGkrKztcclxuICAgIH0gZWxzZSBpZiAoKGMgXiAweGMwKSA8IDMyKXtcclxuICAgICAgY29kZSA9ICgoYyBeIDB4YzApIDw8IDYpIHwgKGJ5dGVzW2krMV0gJiA2Myk7XHJcbiAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpO1xyXG4gICAgICBpICs9IDI7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb2RlID0gKChjICYgMTUpIDw8IDEyKSB8ICgoYnl0ZXNbaSsxXSAmIDYzKSA8PCA2KSB8XHJcbiAgICAgICAgKGJ5dGVzW2krMl0gJiA2Myk7XHJcbiAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNvZGUpO1xyXG4gICAgICBpICs9IDM7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHRoaXMuaW5kZXggKz0gc2l6ZTtcclxuICByZXR1cm4gc3RyO1xyXG59XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX2FycmF5ID0gZnVuY3Rpb24oc2l6ZSl7XHJcbiAgdmFyIG9iamVjdHMgPSBuZXcgQXJyYXkoc2l6ZSk7XHJcbiAgZm9yKHZhciBpID0gMDsgaSA8IHNpemUgOyBpKyspe1xyXG4gICAgb2JqZWN0c1tpXSA9IHRoaXMudW5wYWNrKCk7XHJcbiAgfVxyXG4gIHJldHVybiBvYmplY3RzO1xyXG59XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX21hcCA9IGZ1bmN0aW9uKHNpemUpe1xyXG4gIHZhciBtYXAgPSB7fTtcclxuICBmb3IodmFyIGkgPSAwOyBpIDwgc2l6ZSA7IGkrKyl7XHJcbiAgICB2YXIga2V5ICA9IHRoaXMudW5wYWNrKCk7XHJcbiAgICB2YXIgdmFsdWUgPSB0aGlzLnVucGFjaygpO1xyXG4gICAgbWFwW2tleV0gPSB2YWx1ZTtcclxuICB9XHJcbiAgcmV0dXJuIG1hcDtcclxufVxyXG5cclxuVW5wYWNrZXIucHJvdG90eXBlLnVucGFja19mbG9hdCA9IGZ1bmN0aW9uKCl7XHJcbiAgdmFyIHVpbnQzMiA9IHRoaXMudW5wYWNrX3VpbnQzMigpO1xyXG4gIHZhciBzaWduID0gdWludDMyID4+IDMxO1xyXG4gIHZhciBleHAgID0gKCh1aW50MzIgPj4gMjMpICYgMHhmZikgLSAxMjc7XHJcbiAgdmFyIGZyYWN0aW9uID0gKCB1aW50MzIgJiAweDdmZmZmZiApIHwgMHg4MDAwMDA7XHJcbiAgcmV0dXJuIChzaWduID09IDAgPyAxIDogLTEpICpcclxuICAgIGZyYWN0aW9uICogTWF0aC5wb3coMiwgZXhwIC0gMjMpO1xyXG59XHJcblxyXG5VbnBhY2tlci5wcm90b3R5cGUudW5wYWNrX2RvdWJsZSA9IGZ1bmN0aW9uKCl7XHJcbiAgdmFyIGgzMiA9IHRoaXMudW5wYWNrX3VpbnQzMigpO1xyXG4gIHZhciBsMzIgPSB0aGlzLnVucGFja191aW50MzIoKTtcclxuICB2YXIgc2lnbiA9IGgzMiA+PiAzMTtcclxuICB2YXIgZXhwICA9ICgoaDMyID4+IDIwKSAmIDB4N2ZmKSAtIDEwMjM7XHJcbiAgdmFyIGhmcmFjID0gKCBoMzIgJiAweGZmZmZmICkgfCAweDEwMDAwMDtcclxuICB2YXIgZnJhYyA9IGhmcmFjICogTWF0aC5wb3coMiwgZXhwIC0gMjApICtcclxuICAgIGwzMiAgICogTWF0aC5wb3coMiwgZXhwIC0gNTIpO1xyXG4gIHJldHVybiAoc2lnbiA9PSAwID8gMSA6IC0xKSAqIGZyYWM7XHJcbn1cclxuXHJcblVucGFja2VyLnByb3RvdHlwZS5yZWFkID0gZnVuY3Rpb24obGVuZ3RoKXtcclxuICB2YXIgaiA9IHRoaXMuaW5kZXg7XHJcbiAgaWYgKGogKyBsZW5ndGggPD0gdGhpcy5sZW5ndGgpIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGFWaWV3LnN1YmFycmF5KGosIGogKyBsZW5ndGgpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0JpbmFyeVBhY2tGYWlsdXJlOiByZWFkIGluZGV4IG91dCBvZiByYW5nZScpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gUGFja2VyKCl7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyID0gbmV3IEJ1ZmZlckJ1aWxkZXIoKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5nZXRCdWZmZXIgPSBmdW5jdGlvbigpe1xyXG4gIHJldHVybiB0aGlzLmJ1ZmZlckJ1aWxkZXIuZ2V0QnVmZmVyKCk7XHJcbn1cclxuXHJcblBhY2tlci5wcm90b3R5cGUucGFjayA9IGZ1bmN0aW9uKHZhbHVlKXtcclxuICB2YXIgdHlwZSA9IHR5cGVvZih2YWx1ZSk7XHJcbiAgaWYgKHR5cGUgPT0gJ3N0cmluZycpe1xyXG4gICAgdGhpcy5wYWNrX3N0cmluZyh2YWx1ZSk7XHJcbiAgfSBlbHNlIGlmICh0eXBlID09ICdudW1iZXInKXtcclxuICAgIGlmIChNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUpe1xyXG4gICAgICB0aGlzLnBhY2tfaW50ZWdlcih2YWx1ZSk7XHJcbiAgICB9IGVsc2V7XHJcbiAgICAgIHRoaXMucGFja19kb3VibGUodmFsdWUpO1xyXG4gICAgfVxyXG4gIH0gZWxzZSBpZiAodHlwZSA9PSAnYm9vbGVhbicpe1xyXG4gICAgaWYgKHZhbHVlID09PSB0cnVlKXtcclxuICAgICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGMzKTtcclxuICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IGZhbHNlKXtcclxuICAgICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGMyKTtcclxuICAgIH1cclxuICB9IGVsc2UgaWYgKHR5cGUgPT0gJ3VuZGVmaW5lZCcpe1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGMwKTtcclxuICB9IGVsc2UgaWYgKHR5cGUgPT0gJ29iamVjdCcpe1xyXG4gICAgaWYgKHZhbHVlID09PSBudWxsKXtcclxuICAgICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGMwKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHZhciBjb25zdHJ1Y3RvciA9IHZhbHVlLmNvbnN0cnVjdG9yO1xyXG4gICAgICBpZiAoY29uc3RydWN0b3IgPT0gQXJyYXkpe1xyXG4gICAgICAgIHRoaXMucGFja19hcnJheSh2YWx1ZSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoY29uc3RydWN0b3IgPT0gQmxvYiB8fCBjb25zdHJ1Y3RvciA9PSBGaWxlKSB7XHJcbiAgICAgICAgdGhpcy5wYWNrX2Jpbih2YWx1ZSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoY29uc3RydWN0b3IgPT0gQXJyYXlCdWZmZXIpIHtcclxuICAgICAgICBpZihiaW5hcnlGZWF0dXJlcy51c2VBcnJheUJ1ZmZlclZpZXcpIHtcclxuICAgICAgICAgIHRoaXMucGFja19iaW4obmV3IFVpbnQ4QXJyYXkodmFsdWUpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5wYWNrX2Jpbih2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKCdCWVRFU19QRVJfRUxFTUVOVCcgaW4gdmFsdWUpe1xyXG4gICAgICAgIGlmKGJpbmFyeUZlYXR1cmVzLnVzZUFycmF5QnVmZmVyVmlldykge1xyXG4gICAgICAgICAgdGhpcy5wYWNrX2JpbihuZXcgVWludDhBcnJheSh2YWx1ZS5idWZmZXIpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5wYWNrX2Jpbih2YWx1ZS5idWZmZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmIChjb25zdHJ1Y3RvciA9PSBPYmplY3Qpe1xyXG4gICAgICAgIHRoaXMucGFja19vYmplY3QodmFsdWUpO1xyXG4gICAgICB9IGVsc2UgaWYgKGNvbnN0cnVjdG9yID09IERhdGUpe1xyXG4gICAgICAgIHRoaXMucGFja19zdHJpbmcodmFsdWUudG9TdHJpbmcoKSk7XHJcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlLnRvQmluYXJ5UGFjayA9PSAnZnVuY3Rpb24nKXtcclxuICAgICAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKHZhbHVlLnRvQmluYXJ5UGFjaygpKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1R5cGUgXCInICsgY29uc3RydWN0b3IudG9TdHJpbmcoKSArICdcIiBub3QgeWV0IHN1cHBvcnRlZCcpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSBlbHNlIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignVHlwZSBcIicgKyB0eXBlICsgJ1wiIG5vdCB5ZXQgc3VwcG9ydGVkJyk7XHJcbiAgfVxyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5mbHVzaCgpO1xyXG59XHJcblxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX2JpbiA9IGZ1bmN0aW9uKGJsb2Ipe1xyXG4gIHZhciBsZW5ndGggPSBibG9iLmxlbmd0aCB8fCBibG9iLmJ5dGVMZW5ndGggfHwgYmxvYi5zaXplO1xyXG4gIGlmIChsZW5ndGggPD0gMHgwZil7XHJcbiAgICB0aGlzLnBhY2tfdWludDgoMHhhMCArIGxlbmd0aCk7XHJcbiAgfSBlbHNlIGlmIChsZW5ndGggPD0gMHhmZmZmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhkYSkgO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQxNihsZW5ndGgpO1xyXG4gIH0gZWxzZSBpZiAobGVuZ3RoIDw9IDB4ZmZmZmZmZmYpe1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGRiKTtcclxuICAgIHRoaXMucGFja191aW50MzIobGVuZ3RoKTtcclxuICB9IGVsc2V7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGVuZ3RoJyk7XHJcbiAgfVxyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoYmxvYik7XHJcbn1cclxuXHJcblBhY2tlci5wcm90b3R5cGUucGFja19zdHJpbmcgPSBmdW5jdGlvbihzdHIpe1xyXG4gIHZhciBsZW5ndGggPSB1dGY4TGVuZ3RoKHN0cik7XHJcblxyXG4gIGlmIChsZW5ndGggPD0gMHgwZil7XHJcbiAgICB0aGlzLnBhY2tfdWludDgoMHhiMCArIGxlbmd0aCk7XHJcbiAgfSBlbHNlIGlmIChsZW5ndGggPD0gMHhmZmZmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhkOCkgO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQxNihsZW5ndGgpO1xyXG4gIH0gZWxzZSBpZiAobGVuZ3RoIDw9IDB4ZmZmZmZmZmYpe1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGQ5KTtcclxuICAgIHRoaXMucGFja191aW50MzIobGVuZ3RoKTtcclxuICB9IGVsc2V7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGVuZ3RoJyk7XHJcbiAgfVxyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoc3RyKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX2FycmF5ID0gZnVuY3Rpb24oYXJ5KXtcclxuICB2YXIgbGVuZ3RoID0gYXJ5Lmxlbmd0aDtcclxuICBpZiAobGVuZ3RoIDw9IDB4MGYpe1xyXG4gICAgdGhpcy5wYWNrX3VpbnQ4KDB4OTAgKyBsZW5ndGgpO1xyXG4gIH0gZWxzZSBpZiAobGVuZ3RoIDw9IDB4ZmZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4ZGMpXHJcbiAgICB0aGlzLnBhY2tfdWludDE2KGxlbmd0aCk7XHJcbiAgfSBlbHNlIGlmIChsZW5ndGggPD0gMHhmZmZmZmZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4ZGQpO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQzMihsZW5ndGgpO1xyXG4gIH0gZWxzZXtcclxuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsZW5ndGgnKTtcclxuICB9XHJcbiAgZm9yKHZhciBpID0gMDsgaSA8IGxlbmd0aCA7IGkrKyl7XHJcbiAgICB0aGlzLnBhY2soYXJ5W2ldKTtcclxuICB9XHJcbn1cclxuXHJcblBhY2tlci5wcm90b3R5cGUucGFja19pbnRlZ2VyID0gZnVuY3Rpb24obnVtKXtcclxuICBpZiAoIC0weDIwIDw9IG51bSAmJiBudW0gPD0gMHg3Zil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKG51bSAmIDB4ZmYpO1xyXG4gIH0gZWxzZSBpZiAoMHgwMCA8PSBudW0gJiYgbnVtIDw9IDB4ZmYpe1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGNjKTtcclxuICAgIHRoaXMucGFja191aW50OChudW0pO1xyXG4gIH0gZWxzZSBpZiAoLTB4ODAgPD0gbnVtICYmIG51bSA8PSAweDdmKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhkMCk7XHJcbiAgICB0aGlzLnBhY2tfaW50OChudW0pO1xyXG4gIH0gZWxzZSBpZiAoIDB4MDAwMCA8PSBudW0gJiYgbnVtIDw9IDB4ZmZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4Y2QpO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQxNihudW0pO1xyXG4gIH0gZWxzZSBpZiAoLTB4ODAwMCA8PSBudW0gJiYgbnVtIDw9IDB4N2ZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4ZDEpO1xyXG4gICAgdGhpcy5wYWNrX2ludDE2KG51bSk7XHJcbiAgfSBlbHNlIGlmICggMHgwMDAwMDAwMCA8PSBudW0gJiYgbnVtIDw9IDB4ZmZmZmZmZmYpe1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGNlKTtcclxuICAgIHRoaXMucGFja191aW50MzIobnVtKTtcclxuICB9IGVsc2UgaWYgKC0weDgwMDAwMDAwIDw9IG51bSAmJiBudW0gPD0gMHg3ZmZmZmZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4ZDIpO1xyXG4gICAgdGhpcy5wYWNrX2ludDMyKG51bSk7XHJcbiAgfSBlbHNlIGlmICgtMHg4MDAwMDAwMDAwMDAwMDAwIDw9IG51bSAmJiBudW0gPD0gMHg3RkZGRkZGRkZGRkZGRkZGKXtcclxuICAgIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoMHhkMyk7XHJcbiAgICB0aGlzLnBhY2tfaW50NjQobnVtKTtcclxuICB9IGVsc2UgaWYgKDB4MDAwMDAwMDAwMDAwMDAwMCA8PSBudW0gJiYgbnVtIDw9IDB4RkZGRkZGRkZGRkZGRkZGRil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4Y2YpO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQ2NChudW0pO1xyXG4gIH0gZWxzZXtcclxuICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBpbnRlZ2VyJyk7XHJcbiAgfVxyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfZG91YmxlID0gZnVuY3Rpb24obnVtKXtcclxuICB2YXIgc2lnbiA9IDA7XHJcbiAgaWYgKG51bSA8IDApe1xyXG4gICAgc2lnbiA9IDE7XHJcbiAgICBudW0gPSAtbnVtO1xyXG4gIH1cclxuICB2YXIgZXhwICA9IE1hdGguZmxvb3IoTWF0aC5sb2cobnVtKSAvIE1hdGguTE4yKTtcclxuICB2YXIgZnJhYzAgPSBudW0gLyBNYXRoLnBvdygyLCBleHApIC0gMTtcclxuICB2YXIgZnJhYzEgPSBNYXRoLmZsb29yKGZyYWMwICogTWF0aC5wb3coMiwgNTIpKTtcclxuICB2YXIgYjMyICAgPSBNYXRoLnBvdygyLCAzMik7XHJcbiAgdmFyIGgzMiA9IChzaWduIDw8IDMxKSB8ICgoZXhwKzEwMjMpIDw8IDIwKSB8XHJcbiAgICAgIChmcmFjMSAvIGIzMikgJiAweDBmZmZmZjtcclxuICB2YXIgbDMyID0gZnJhYzEgJSBiMzI7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGNiKTtcclxuICB0aGlzLnBhY2tfaW50MzIoaDMyKTtcclxuICB0aGlzLnBhY2tfaW50MzIobDMyKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX29iamVjdCA9IGZ1bmN0aW9uKG9iail7XHJcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xyXG4gIHZhciBsZW5ndGggPSBrZXlzLmxlbmd0aDtcclxuICBpZiAobGVuZ3RoIDw9IDB4MGYpe1xyXG4gICAgdGhpcy5wYWNrX3VpbnQ4KDB4ODAgKyBsZW5ndGgpO1xyXG4gIH0gZWxzZSBpZiAobGVuZ3RoIDw9IDB4ZmZmZil7XHJcbiAgICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKDB4ZGUpO1xyXG4gICAgdGhpcy5wYWNrX3VpbnQxNihsZW5ndGgpO1xyXG4gIH0gZWxzZSBpZiAobGVuZ3RoIDw9IDB4ZmZmZmZmZmYpe1xyXG4gICAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgweGRmKTtcclxuICAgIHRoaXMucGFja191aW50MzIobGVuZ3RoKTtcclxuICB9IGVsc2V7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGVuZ3RoJyk7XHJcbiAgfVxyXG4gIGZvcih2YXIgcHJvcCBpbiBvYmope1xyXG4gICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSl7XHJcbiAgICAgIHRoaXMucGFjayhwcm9wKTtcclxuICAgICAgdGhpcy5wYWNrKG9ialtwcm9wXSk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfdWludDggPSBmdW5jdGlvbihudW0pe1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQobnVtKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX3VpbnQxNiA9IGZ1bmN0aW9uKG51bSl7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZChudW0gPj4gOCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZChudW0gJiAweGZmKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX3VpbnQzMiA9IGZ1bmN0aW9uKG51bSl7XHJcbiAgdmFyIG4gPSBudW0gJiAweGZmZmZmZmZmO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKG4gJiAweGZmMDAwMDAwKSA+Pj4gMjQpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKG4gJiAweDAwZmYwMDAwKSA+Pj4gMTYpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKG4gJiAweDAwMDBmZjAwKSA+Pj4gIDgpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKG4gJiAweDAwMDAwMGZmKSk7XHJcbn1cclxuXHJcblBhY2tlci5wcm90b3R5cGUucGFja191aW50NjQgPSBmdW5jdGlvbihudW0pe1xyXG4gIHZhciBoaWdoID0gbnVtIC8gTWF0aC5wb3coMiwgMzIpO1xyXG4gIHZhciBsb3cgID0gbnVtICUgTWF0aC5wb3coMiwgMzIpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKGhpZ2ggJiAweGZmMDAwMDAwKSA+Pj4gMjQpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKGhpZ2ggJiAweDAwZmYwMDAwKSA+Pj4gMTYpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKGhpZ2ggJiAweDAwMDBmZjAwKSA+Pj4gIDgpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKGhpZ2ggJiAweDAwMDAwMGZmKSk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobG93ICAmIDB4ZmYwMDAwMDApID4+PiAyNCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobG93ICAmIDB4MDBmZjAwMDApID4+PiAxNik7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobG93ICAmIDB4MDAwMGZmMDApID4+PiAgOCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobG93ICAmIDB4MDAwMDAwZmYpKTtcclxufVxyXG5cclxuUGFja2VyLnByb3RvdHlwZS5wYWNrX2ludDggPSBmdW5jdGlvbihudW0pe1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQobnVtICYgMHhmZik7XHJcbn1cclxuXHJcblBhY2tlci5wcm90b3R5cGUucGFja19pbnQxNiA9IGZ1bmN0aW9uKG51bSl7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobnVtICYgMHhmZjAwKSA+PiA4KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKG51bSAmIDB4ZmYpO1xyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfaW50MzIgPSBmdW5jdGlvbihudW0pe1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKG51bSA+Pj4gMjQpICYgMHhmZik7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobnVtICYgMHgwMGZmMDAwMCkgPj4+IDE2KTtcclxuICB0aGlzLmJ1ZmZlckJ1aWxkZXIuYXBwZW5kKChudW0gJiAweDAwMDBmZjAwKSA+Pj4gOCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobnVtICYgMHgwMDAwMDBmZikpO1xyXG59XHJcblxyXG5QYWNrZXIucHJvdG90eXBlLnBhY2tfaW50NjQgPSBmdW5jdGlvbihudW0pe1xyXG4gIHZhciBoaWdoID0gTWF0aC5mbG9vcihudW0gLyBNYXRoLnBvdygyLCAzMikpO1xyXG4gIHZhciBsb3cgID0gbnVtICUgTWF0aC5wb3coMiwgMzIpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKGhpZ2ggJiAweGZmMDAwMDAwKSA+Pj4gMjQpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKGhpZ2ggJiAweDAwZmYwMDAwKSA+Pj4gMTYpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKGhpZ2ggJiAweDAwMDBmZjAwKSA+Pj4gIDgpO1xyXG4gIHRoaXMuYnVmZmVyQnVpbGRlci5hcHBlbmQoKGhpZ2ggJiAweDAwMDAwMGZmKSk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobG93ICAmIDB4ZmYwMDAwMDApID4+PiAyNCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobG93ICAmIDB4MDBmZjAwMDApID4+PiAxNik7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobG93ICAmIDB4MDAwMGZmMDApID4+PiAgOCk7XHJcbiAgdGhpcy5idWZmZXJCdWlsZGVyLmFwcGVuZCgobG93ICAmIDB4MDAwMDAwZmYpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3V0ZjhSZXBsYWNlKG0pe1xyXG4gIHZhciBjb2RlID0gbS5jaGFyQ29kZUF0KDApO1xyXG5cclxuICBpZihjb2RlIDw9IDB4N2ZmKSByZXR1cm4gJzAwJztcclxuICBpZihjb2RlIDw9IDB4ZmZmZikgcmV0dXJuICcwMDAnO1xyXG4gIGlmKGNvZGUgPD0gMHgxZmZmZmYpIHJldHVybiAnMDAwMCc7XHJcbiAgaWYoY29kZSA8PSAweDNmZmZmZmYpIHJldHVybiAnMDAwMDAnO1xyXG4gIHJldHVybiAnMDAwMDAwJztcclxufVxyXG5cclxuZnVuY3Rpb24gdXRmOExlbmd0aChzdHIpe1xyXG4gIGlmIChzdHIubGVuZ3RoID4gNjAwKSB7XHJcbiAgICAvLyBCbG9iIG1ldGhvZCBmYXN0ZXIgZm9yIGxhcmdlIHN0cmluZ3NcclxuICAgIHJldHVybiAobmV3IEJsb2IoW3N0cl0pKS5zaXplO1xyXG4gIH0gZWxzZSB7XHJcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoL1teXFx1MDAwMC1cXHUwMDdGXS9nLCBfdXRmOFJlcGxhY2UpLmxlbmd0aDtcclxuICB9XHJcbn1cclxuIiwidmFyIGJpbmFyeUZlYXR1cmVzID0ge307XHJcbmJpbmFyeUZlYXR1cmVzLnVzZUJsb2JCdWlsZGVyID0gKGZ1bmN0aW9uKCl7XHJcbiAgdHJ5IHtcclxuICAgIG5ldyBCbG9iKFtdKTtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9IGNhdGNoIChlKSB7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcbn0pKCk7XHJcblxyXG5iaW5hcnlGZWF0dXJlcy51c2VBcnJheUJ1ZmZlclZpZXcgPSAhYmluYXJ5RmVhdHVyZXMudXNlQmxvYkJ1aWxkZXIgJiYgKGZ1bmN0aW9uKCl7XHJcbiAgdHJ5IHtcclxuICAgIHJldHVybiAobmV3IEJsb2IoW25ldyBVaW50OEFycmF5KFtdKV0pKS5zaXplID09PSAwO1xyXG4gIH0gY2F0Y2ggKGUpIHtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxufSkoKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzLmJpbmFyeUZlYXR1cmVzID0gYmluYXJ5RmVhdHVyZXM7XHJcbnZhciBCbG9iQnVpbGRlciA9IG1vZHVsZS5leHBvcnRzLkJsb2JCdWlsZGVyO1xyXG5pZiAodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJykge1xyXG4gIEJsb2JCdWlsZGVyID0gbW9kdWxlLmV4cG9ydHMuQmxvYkJ1aWxkZXIgPSB3aW5kb3cuV2ViS2l0QmxvYkJ1aWxkZXIgfHxcclxuICAgIHdpbmRvdy5Nb3pCbG9iQnVpbGRlciB8fCB3aW5kb3cuTVNCbG9iQnVpbGRlciB8fCB3aW5kb3cuQmxvYkJ1aWxkZXI7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIEJ1ZmZlckJ1aWxkZXIoKXtcclxuICB0aGlzLl9waWVjZXMgPSBbXTtcclxuICB0aGlzLl9wYXJ0cyA9IFtdO1xyXG59XHJcblxyXG5CdWZmZXJCdWlsZGVyLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbihkYXRhKSB7XHJcbiAgaWYodHlwZW9mIGRhdGEgPT09ICdudW1iZXInKSB7XHJcbiAgICB0aGlzLl9waWVjZXMucHVzaChkYXRhKTtcclxuICB9IGVsc2Uge1xyXG4gICAgdGhpcy5mbHVzaCgpO1xyXG4gICAgdGhpcy5fcGFydHMucHVzaChkYXRhKTtcclxuICB9XHJcbn07XHJcblxyXG5CdWZmZXJCdWlsZGVyLnByb3RvdHlwZS5mbHVzaCA9IGZ1bmN0aW9uKCkge1xyXG4gIGlmICh0aGlzLl9waWVjZXMubGVuZ3RoID4gMCkge1xyXG4gICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3BpZWNlcyk7XHJcbiAgICBpZighYmluYXJ5RmVhdHVyZXMudXNlQXJyYXlCdWZmZXJWaWV3KSB7XHJcbiAgICAgIGJ1ZiA9IGJ1Zi5idWZmZXI7XHJcbiAgICB9XHJcbiAgICB0aGlzLl9wYXJ0cy5wdXNoKGJ1Zik7XHJcbiAgICB0aGlzLl9waWVjZXMgPSBbXTtcclxuICB9XHJcbn07XHJcblxyXG5CdWZmZXJCdWlsZGVyLnByb3RvdHlwZS5nZXRCdWZmZXIgPSBmdW5jdGlvbigpIHtcclxuICB0aGlzLmZsdXNoKCk7XHJcbiAgaWYoYmluYXJ5RmVhdHVyZXMudXNlQmxvYkJ1aWxkZXIpIHtcclxuICAgIHZhciBidWlsZGVyID0gbmV3IEJsb2JCdWlsZGVyKCk7XHJcbiAgICBmb3IodmFyIGkgPSAwLCBpaSA9IHRoaXMuX3BhcnRzLmxlbmd0aDsgaSA8IGlpOyBpKyspIHtcclxuICAgICAgYnVpbGRlci5hcHBlbmQodGhpcy5fcGFydHNbaV0pO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGJ1aWxkZXIuZ2V0QmxvYigpO1xyXG4gIH0gZWxzZSB7XHJcbiAgICByZXR1cm4gbmV3IEJsb2IodGhpcy5fcGFydHMpO1xyXG4gIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzLkJ1ZmZlckJ1aWxkZXIgPSBCdWZmZXJCdWlsZGVyO1xyXG4iLCJtb2R1bGUuZXhwb3J0cy5SVENTZXNzaW9uRGVzY3JpcHRpb24gPSB3aW5kb3cuUlRDU2Vzc2lvbkRlc2NyaXB0aW9uIHx8XG5cdHdpbmRvdy5tb3pSVENTZXNzaW9uRGVzY3JpcHRpb247XG5tb2R1bGUuZXhwb3J0cy5SVENQZWVyQ29ubmVjdGlvbiA9IHdpbmRvdy5SVENQZWVyQ29ubmVjdGlvbiB8fFxuXHR3aW5kb3cubW96UlRDUGVlckNvbm5lY3Rpb24gfHwgd2luZG93LndlYmtpdFJUQ1BlZXJDb25uZWN0aW9uO1xubW9kdWxlLmV4cG9ydHMuUlRDSWNlQ2FuZGlkYXRlID0gd2luZG93LlJUQ0ljZUNhbmRpZGF0ZSB8fFxuXHR3aW5kb3cubW96UlRDSWNlQ2FuZGlkYXRlO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIzJyk7XG52YXIgTmVnb3RpYXRvciA9IHJlcXVpcmUoJy4vbmVnb3RpYXRvcicpO1xudmFyIFJlbGlhYmxlID0gcmVxdWlyZSgncmVsaWFibGUnKTtcblxuLyoqXG4gKiBXcmFwcyBhIERhdGFDaGFubmVsIGJldHdlZW4gdHdvIFBlZXJzLlxuICovXG5mdW5jdGlvbiBEYXRhQ29ubmVjdGlvbihwZWVyLCBwcm92aWRlciwgb3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRGF0YUNvbm5lY3Rpb24pKSByZXR1cm4gbmV3IERhdGFDb25uZWN0aW9uKHBlZXIsIHByb3ZpZGVyLCBvcHRpb25zKTtcbiAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgdGhpcy5vcHRpb25zID0gdXRpbC5leHRlbmQoe1xuICAgIHNlcmlhbGl6YXRpb246ICdiaW5hcnknLFxuICAgIHJlbGlhYmxlOiBmYWxzZVxuICB9LCBvcHRpb25zKTtcblxuICAvLyBDb25uZWN0aW9uIGlzIG5vdCBvcGVuIHlldC5cbiAgdGhpcy5vcGVuID0gZmFsc2U7XG4gIHRoaXMudHlwZSA9ICdkYXRhJztcbiAgdGhpcy5wZWVyID0gcGVlcjtcbiAgdGhpcy5wcm92aWRlciA9IHByb3ZpZGVyO1xuXG4gIHRoaXMuaWQgPSB0aGlzLm9wdGlvbnMuY29ubmVjdGlvbklkIHx8IERhdGFDb25uZWN0aW9uLl9pZFByZWZpeCArIHV0aWwucmFuZG9tVG9rZW4oKTtcblxuICB0aGlzLmxhYmVsID0gdGhpcy5vcHRpb25zLmxhYmVsIHx8IHRoaXMuaWQ7XG4gIHRoaXMubWV0YWRhdGEgPSB0aGlzLm9wdGlvbnMubWV0YWRhdGE7XG4gIHRoaXMuc2VyaWFsaXphdGlvbiA9IHRoaXMub3B0aW9ucy5zZXJpYWxpemF0aW9uO1xuICB0aGlzLnJlbGlhYmxlID0gdGhpcy5vcHRpb25zLnJlbGlhYmxlO1xuXG4gIC8vIERhdGEgY2hhbm5lbCBidWZmZXJpbmcuXG4gIHRoaXMuX2J1ZmZlciA9IFtdO1xuICB0aGlzLl9idWZmZXJpbmcgPSBmYWxzZTtcbiAgdGhpcy5idWZmZXJTaXplID0gMDtcblxuICAvLyBGb3Igc3RvcmluZyBsYXJnZSBkYXRhLlxuICB0aGlzLl9jaHVua2VkRGF0YSA9IHt9O1xuXG4gIGlmICh0aGlzLm9wdGlvbnMuX3BheWxvYWQpIHtcbiAgICB0aGlzLl9wZWVyQnJvd3NlciA9IHRoaXMub3B0aW9ucy5fcGF5bG9hZC5icm93c2VyO1xuICB9XG5cbiAgTmVnb3RpYXRvci5zdGFydENvbm5lY3Rpb24oXG4gICAgdGhpcyxcbiAgICB0aGlzLm9wdGlvbnMuX3BheWxvYWQgfHwge1xuICAgICAgb3JpZ2luYXRvcjogdHJ1ZVxuICAgIH1cbiAgKTtcbn1cblxudXRpbC5pbmhlcml0cyhEYXRhQ29ubmVjdGlvbiwgRXZlbnRFbWl0dGVyKTtcblxuRGF0YUNvbm5lY3Rpb24uX2lkUHJlZml4ID0gJ2RjXyc7XG5cbi8qKiBDYWxsZWQgYnkgdGhlIE5lZ290aWF0b3Igd2hlbiB0aGUgRGF0YUNoYW5uZWwgaXMgcmVhZHkuICovXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKGRjKSB7XG4gIHRoaXMuX2RjID0gdGhpcy5kYXRhQ2hhbm5lbCA9IGRjO1xuICB0aGlzLl9jb25maWd1cmVEYXRhQ2hhbm5lbCgpO1xufVxuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuX2NvbmZpZ3VyZURhdGFDaGFubmVsID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgaWYgKHV0aWwuc3VwcG9ydHMuc2N0cCkge1xuICAgIHRoaXMuX2RjLmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICB9XG4gIHRoaXMuX2RjLm9ub3BlbiA9IGZ1bmN0aW9uKCkge1xuICAgIHV0aWwubG9nKCdEYXRhIGNoYW5uZWwgY29ubmVjdGlvbiBzdWNjZXNzJyk7XG4gICAgc2VsZi5vcGVuID0gdHJ1ZTtcbiAgICBzZWxmLmVtaXQoJ29wZW4nKTtcbiAgfVxuXG4gIC8vIFVzZSB0aGUgUmVsaWFibGUgc2hpbSBmb3Igbm9uIEZpcmVmb3ggYnJvd3NlcnNcbiAgaWYgKCF1dGlsLnN1cHBvcnRzLnNjdHAgJiYgdGhpcy5yZWxpYWJsZSkge1xuICAgIHRoaXMuX3JlbGlhYmxlID0gbmV3IFJlbGlhYmxlKHRoaXMuX2RjLCB1dGlsLmRlYnVnKTtcbiAgfVxuXG4gIGlmICh0aGlzLl9yZWxpYWJsZSkge1xuICAgIHRoaXMuX3JlbGlhYmxlLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKG1zZykge1xuICAgICAgc2VsZi5lbWl0KCdkYXRhJywgbXNnKTtcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHRoaXMuX2RjLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgIHNlbGYuX2hhbmRsZURhdGFNZXNzYWdlKGUpO1xuICAgIH07XG4gIH1cbiAgdGhpcy5fZGMub25jbG9zZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICB1dGlsLmxvZygnRGF0YUNoYW5uZWwgY2xvc2VkIGZvcjonLCBzZWxmLnBlZXIpO1xuICAgIHNlbGYuY2xvc2UoKTtcbiAgfTtcbn1cblxuLy8gSGFuZGxlcyBhIERhdGFDaGFubmVsIG1lc3NhZ2UuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuX2hhbmRsZURhdGFNZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBkYXRhID0gZS5kYXRhO1xuICB2YXIgZGF0YXR5cGUgPSBkYXRhLmNvbnN0cnVjdG9yO1xuICBpZiAodGhpcy5zZXJpYWxpemF0aW9uID09PSAnYmluYXJ5JyB8fCB0aGlzLnNlcmlhbGl6YXRpb24gPT09ICdiaW5hcnktdXRmOCcpIHtcbiAgICBpZiAoZGF0YXR5cGUgPT09IEJsb2IpIHtcbiAgICAgIC8vIERhdGF0eXBlIHNob3VsZCBuZXZlciBiZSBibG9iXG4gICAgICB1dGlsLmJsb2JUb0FycmF5QnVmZmVyKGRhdGEsIGZ1bmN0aW9uKGFiKSB7XG4gICAgICAgIGRhdGEgPSB1dGlsLnVucGFjayhhYik7XG4gICAgICAgIHNlbGYuZW1pdCgnZGF0YScsIGRhdGEpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChkYXRhdHlwZSA9PT0gQXJyYXlCdWZmZXIpIHtcbiAgICAgIGRhdGEgPSB1dGlsLnVucGFjayhkYXRhKTtcbiAgICB9IGVsc2UgaWYgKGRhdGF0eXBlID09PSBTdHJpbmcpIHtcbiAgICAgIC8vIFN0cmluZyBmYWxsYmFjayBmb3IgYmluYXJ5IGRhdGEgZm9yIGJyb3dzZXJzIHRoYXQgZG9uJ3Qgc3VwcG9ydCBiaW5hcnkgeWV0XG4gICAgICB2YXIgYWIgPSB1dGlsLmJpbmFyeVN0cmluZ1RvQXJyYXlCdWZmZXIoZGF0YSk7XG4gICAgICBkYXRhID0gdXRpbC51bnBhY2soYWIpO1xuICAgIH1cbiAgfSBlbHNlIGlmICh0aGlzLnNlcmlhbGl6YXRpb24gPT09ICdqc29uJykge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICB9XG5cbiAgLy8gQ2hlY2sgaWYgd2UndmUgY2h1bmtlZC0taWYgc28sIHBpZWNlIHRoaW5ncyBiYWNrIHRvZ2V0aGVyLlxuICAvLyBXZSdyZSBndWFyYW50ZWVkIHRoYXQgdGhpcyBpc24ndCAwLlxuICBpZiAoZGF0YS5fX3BlZXJEYXRhKSB7XG4gICAgdmFyIGlkID0gZGF0YS5fX3BlZXJEYXRhO1xuICAgIHZhciBjaHVua0luZm8gPSB0aGlzLl9jaHVua2VkRGF0YVtpZF0gfHwge2RhdGE6IFtdLCBjb3VudDogMCwgdG90YWw6IGRhdGEudG90YWx9O1xuXG4gICAgY2h1bmtJbmZvLmRhdGFbZGF0YS5uXSA9IGRhdGEuZGF0YTtcbiAgICBjaHVua0luZm8uY291bnQgKz0gMTtcblxuICAgIGlmIChjaHVua0luZm8udG90YWwgPT09IGNodW5rSW5mby5jb3VudCkge1xuICAgICAgLy8gQ2xlYW4gdXAgYmVmb3JlIG1ha2luZyB0aGUgcmVjdXJzaXZlIGNhbGwgdG8gYF9oYW5kbGVEYXRhTWVzc2FnZWAuXG4gICAgICBkZWxldGUgdGhpcy5fY2h1bmtlZERhdGFbaWRdO1xuXG4gICAgICAvLyBXZSd2ZSByZWNlaXZlZCBhbGwgdGhlIGNodW5rcy0tdGltZSB0byBjb25zdHJ1Y3QgdGhlIGNvbXBsZXRlIGRhdGEuXG4gICAgICBkYXRhID0gbmV3IEJsb2IoY2h1bmtJbmZvLmRhdGEpO1xuICAgICAgdGhpcy5faGFuZGxlRGF0YU1lc3NhZ2Uoe2RhdGE6IGRhdGF9KTtcbiAgICB9XG5cbiAgICB0aGlzLl9jaHVua2VkRGF0YVtpZF0gPSBjaHVua0luZm87XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5lbWl0KCdkYXRhJywgZGF0YSk7XG59XG5cbi8qKlxuICogRXhwb3NlZCBmdW5jdGlvbmFsaXR5IGZvciB1c2Vycy5cbiAqL1xuXG4vKiogQWxsb3dzIHVzZXIgdG8gY2xvc2UgY29ubmVjdGlvbi4gKi9cbkRhdGFDb25uZWN0aW9uLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMub3Blbikge1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLm9wZW4gPSBmYWxzZTtcbiAgTmVnb3RpYXRvci5jbGVhbnVwKHRoaXMpO1xuICB0aGlzLmVtaXQoJ2Nsb3NlJyk7XG59XG5cbi8qKiBBbGxvd3MgdXNlciB0byBzZW5kIGRhdGEuICovXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGRhdGEsIGNodW5rZWQpIHtcbiAgaWYgKCF0aGlzLm9wZW4pIHtcbiAgICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdDb25uZWN0aW9uIGlzIG5vdCBvcGVuLiBZb3Ugc2hvdWxkIGxpc3RlbiBmb3IgdGhlIGBvcGVuYCBldmVudCBiZWZvcmUgc2VuZGluZyBtZXNzYWdlcy4nKSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0aGlzLl9yZWxpYWJsZSkge1xuICAgIC8vIE5vdGU6IHJlbGlhYmxlIHNoaW0gc2VuZGluZyB3aWxsIG1ha2UgaXQgc28gdGhhdCB5b3UgY2Fubm90IGN1c3RvbWl6ZVxuICAgIC8vIHNlcmlhbGl6YXRpb24uXG4gICAgdGhpcy5fcmVsaWFibGUuc2VuZChkYXRhKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAodGhpcy5zZXJpYWxpemF0aW9uID09PSAnanNvbicpIHtcbiAgICB0aGlzLl9idWZmZXJlZFNlbmQoSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuICB9IGVsc2UgaWYgKHRoaXMuc2VyaWFsaXphdGlvbiA9PT0gJ2JpbmFyeScgfHwgdGhpcy5zZXJpYWxpemF0aW9uID09PSAnYmluYXJ5LXV0ZjgnKSB7XG4gICAgdmFyIGJsb2IgPSB1dGlsLnBhY2soZGF0YSk7XG5cbiAgICAvLyBGb3IgQ2hyb21lLUZpcmVmb3ggaW50ZXJvcGVyYWJpbGl0eSwgd2UgbmVlZCB0byBtYWtlIEZpcmVmb3ggXCJjaHVua1wiXG4gICAgLy8gdGhlIGRhdGEgaXQgc2VuZHMgb3V0LlxuICAgIHZhciBuZWVkc0NodW5raW5nID0gdXRpbC5jaHVua2VkQnJvd3NlcnNbdGhpcy5fcGVlckJyb3dzZXJdIHx8IHV0aWwuY2h1bmtlZEJyb3dzZXJzW3V0aWwuYnJvd3Nlcl07XG4gICAgaWYgKG5lZWRzQ2h1bmtpbmcgJiYgIWNodW5rZWQgJiYgYmxvYi5zaXplID4gdXRpbC5jaHVua2VkTVRVKSB7XG4gICAgICB0aGlzLl9zZW5kQ2h1bmtzKGJsb2IpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIERhdGFDaGFubmVsIGN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIHN0cmluZ3MuXG4gICAgaWYgKCF1dGlsLnN1cHBvcnRzLnNjdHApIHtcbiAgICAgIHV0aWwuYmxvYlRvQmluYXJ5U3RyaW5nKGJsb2IsIGZ1bmN0aW9uKHN0cikge1xuICAgICAgICBzZWxmLl9idWZmZXJlZFNlbmQoc3RyKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoIXV0aWwuc3VwcG9ydHMuYmluYXJ5QmxvYikge1xuICAgICAgLy8gV2Ugb25seSBkbyB0aGlzIGlmIHdlIHJlYWxseSBuZWVkIHRvIChlLmcuIGJsb2JzIGFyZSBub3Qgc3VwcG9ydGVkKSxcbiAgICAgIC8vIGJlY2F1c2UgdGhpcyBjb252ZXJzaW9uIGlzIGNvc3RseS5cbiAgICAgIHV0aWwuYmxvYlRvQXJyYXlCdWZmZXIoYmxvYiwgZnVuY3Rpb24oYWIpIHtcbiAgICAgICAgc2VsZi5fYnVmZmVyZWRTZW5kKGFiKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9idWZmZXJlZFNlbmQoYmxvYik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXMuX2J1ZmZlcmVkU2VuZChkYXRhKTtcbiAgfVxufVxuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuX2J1ZmZlcmVkU2VuZCA9IGZ1bmN0aW9uKG1zZykge1xuICBpZiAodGhpcy5fYnVmZmVyaW5nIHx8ICF0aGlzLl90cnlTZW5kKG1zZykpIHtcbiAgICB0aGlzLl9idWZmZXIucHVzaChtc2cpO1xuICAgIHRoaXMuYnVmZmVyU2l6ZSA9IHRoaXMuX2J1ZmZlci5sZW5ndGg7XG4gIH1cbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoZSBzZW5kIHN1Y2NlZWRzLlxuRGF0YUNvbm5lY3Rpb24ucHJvdG90eXBlLl90cnlTZW5kID0gZnVuY3Rpb24obXNnKSB7XG4gIHRyeSB7XG4gICAgdGhpcy5fZGMuc2VuZChtc2cpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhpcy5fYnVmZmVyaW5nID0gdHJ1ZTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgLy8gVHJ5IGFnYWluLlxuICAgICAgc2VsZi5fYnVmZmVyaW5nID0gZmFsc2U7XG4gICAgICBzZWxmLl90cnlCdWZmZXIoKTtcbiAgICB9LCAxMDApO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gVHJ5IHRvIHNlbmQgdGhlIGZpcnN0IG1lc3NhZ2UgaW4gdGhlIGJ1ZmZlci5cbkRhdGFDb25uZWN0aW9uLnByb3RvdHlwZS5fdHJ5QnVmZmVyID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLl9idWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIG1zZyA9IHRoaXMuX2J1ZmZlclswXTtcblxuICBpZiAodGhpcy5fdHJ5U2VuZChtc2cpKSB7XG4gICAgdGhpcy5fYnVmZmVyLnNoaWZ0KCk7XG4gICAgdGhpcy5idWZmZXJTaXplID0gdGhpcy5fYnVmZmVyLmxlbmd0aDtcbiAgICB0aGlzLl90cnlCdWZmZXIoKTtcbiAgfVxufVxuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuX3NlbmRDaHVua3MgPSBmdW5jdGlvbihibG9iKSB7XG4gIHZhciBibG9icyA9IHV0aWwuY2h1bmsoYmxvYik7XG4gIGZvciAodmFyIGkgPSAwLCBpaSA9IGJsb2JzLmxlbmd0aDsgaSA8IGlpOyBpICs9IDEpIHtcbiAgICB2YXIgYmxvYiA9IGJsb2JzW2ldO1xuICAgIHRoaXMuc2VuZChibG9iLCB0cnVlKTtcbiAgfVxufVxuXG5EYXRhQ29ubmVjdGlvbi5wcm90b3R5cGUuaGFuZGxlTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgdmFyIHBheWxvYWQgPSBtZXNzYWdlLnBheWxvYWQ7XG5cbiAgc3dpdGNoIChtZXNzYWdlLnR5cGUpIHtcbiAgICBjYXNlICdBTlNXRVInOlxuICAgICAgdGhpcy5fcGVlckJyb3dzZXIgPSBwYXlsb2FkLmJyb3dzZXI7XG5cbiAgICAgIC8vIEZvcndhcmQgdG8gbmVnb3RpYXRvclxuICAgICAgTmVnb3RpYXRvci5oYW5kbGVTRFAobWVzc2FnZS50eXBlLCB0aGlzLCBwYXlsb2FkLnNkcCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdDQU5ESURBVEUnOlxuICAgICAgTmVnb3RpYXRvci5oYW5kbGVDYW5kaWRhdGUodGhpcywgcGF5bG9hZC5jYW5kaWRhdGUpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHV0aWwud2FybignVW5yZWNvZ25pemVkIG1lc3NhZ2UgdHlwZTonLCBtZXNzYWdlLnR5cGUsICdmcm9tIHBlZXI6JywgdGhpcy5wZWVyKTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gRGF0YUNvbm5lY3Rpb247XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50ZW1pdHRlcjMnKTtcbnZhciBOZWdvdGlhdG9yID0gcmVxdWlyZSgnLi9uZWdvdGlhdG9yJyk7XG5cbi8qKlxuICogV3JhcHMgdGhlIHN0cmVhbWluZyBpbnRlcmZhY2UgYmV0d2VlbiB0d28gUGVlcnMuXG4gKi9cbmZ1bmN0aW9uIE1lZGlhQ29ubmVjdGlvbihwZWVyLCBwcm92aWRlciwgb3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgTWVkaWFDb25uZWN0aW9uKSkgcmV0dXJuIG5ldyBNZWRpYUNvbm5lY3Rpb24ocGVlciwgcHJvdmlkZXIsIG9wdGlvbnMpO1xuICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICB0aGlzLm9wdGlvbnMgPSB1dGlsLmV4dGVuZCh7fSwgb3B0aW9ucyk7XG5cbiAgdGhpcy5vcGVuID0gZmFsc2U7XG4gIHRoaXMudHlwZSA9ICdtZWRpYSc7XG4gIHRoaXMucGVlciA9IHBlZXI7XG4gIHRoaXMucHJvdmlkZXIgPSBwcm92aWRlcjtcbiAgdGhpcy5tZXRhZGF0YSA9IHRoaXMub3B0aW9ucy5tZXRhZGF0YTtcbiAgdGhpcy5sb2NhbFN0cmVhbSA9IHRoaXMub3B0aW9ucy5fc3RyZWFtO1xuXG4gIHRoaXMuaWQgPSB0aGlzLm9wdGlvbnMuY29ubmVjdGlvbklkIHx8IE1lZGlhQ29ubmVjdGlvbi5faWRQcmVmaXggKyB1dGlsLnJhbmRvbVRva2VuKCk7XG4gIGlmICh0aGlzLmxvY2FsU3RyZWFtKSB7XG4gICAgTmVnb3RpYXRvci5zdGFydENvbm5lY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAge19zdHJlYW06IHRoaXMubG9jYWxTdHJlYW0sIG9yaWdpbmF0b3I6IHRydWV9XG4gICAgKTtcbiAgfVxufTtcblxudXRpbC5pbmhlcml0cyhNZWRpYUNvbm5lY3Rpb24sIEV2ZW50RW1pdHRlcik7XG5cbk1lZGlhQ29ubmVjdGlvbi5faWRQcmVmaXggPSAnbWNfJztcblxuTWVkaWFDb25uZWN0aW9uLnByb3RvdHlwZS5hZGRTdHJlYW0gPSBmdW5jdGlvbihyZW1vdGVTdHJlYW0pIHtcbiAgdXRpbC5sb2coJ1JlY2VpdmluZyBzdHJlYW0nLCByZW1vdGVTdHJlYW0pO1xuXG4gIHRoaXMucmVtb3RlU3RyZWFtID0gcmVtb3RlU3RyZWFtO1xuICB0aGlzLmVtaXQoJ3N0cmVhbScsIHJlbW90ZVN0cmVhbSk7IC8vIFNob3VsZCB3ZSBjYWxsIHRoaXMgYG9wZW5gP1xuXG59O1xuXG5NZWRpYUNvbm5lY3Rpb24ucHJvdG90eXBlLmhhbmRsZU1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gIHZhciBwYXlsb2FkID0gbWVzc2FnZS5wYXlsb2FkO1xuXG4gIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XG4gICAgY2FzZSAnQU5TV0VSJzpcbiAgICAgIC8vIEZvcndhcmQgdG8gbmVnb3RpYXRvclxuICAgICAgTmVnb3RpYXRvci5oYW5kbGVTRFAobWVzc2FnZS50eXBlLCB0aGlzLCBwYXlsb2FkLnNkcCk7XG4gICAgICB0aGlzLm9wZW4gPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQ0FORElEQVRFJzpcbiAgICAgIE5lZ290aWF0b3IuaGFuZGxlQ2FuZGlkYXRlKHRoaXMsIHBheWxvYWQuY2FuZGlkYXRlKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICB1dGlsLndhcm4oJ1VucmVjb2duaXplZCBtZXNzYWdlIHR5cGU6JywgbWVzc2FnZS50eXBlLCAnZnJvbSBwZWVyOicsIHRoaXMucGVlcik7XG4gICAgICBicmVhaztcbiAgfVxufVxuXG5NZWRpYUNvbm5lY3Rpb24ucHJvdG90eXBlLmFuc3dlciA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICBpZiAodGhpcy5sb2NhbFN0cmVhbSkge1xuICAgIHV0aWwud2FybignTG9jYWwgc3RyZWFtIGFscmVhZHkgZXhpc3RzIG9uIHRoaXMgTWVkaWFDb25uZWN0aW9uLiBBcmUgeW91IGFuc3dlcmluZyBhIGNhbGwgdHdpY2U/Jyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5vcHRpb25zLl9wYXlsb2FkLl9zdHJlYW0gPSBzdHJlYW07XG5cbiAgdGhpcy5sb2NhbFN0cmVhbSA9IHN0cmVhbTtcbiAgTmVnb3RpYXRvci5zdGFydENvbm5lY3Rpb24oXG4gICAgdGhpcyxcbiAgICB0aGlzLm9wdGlvbnMuX3BheWxvYWRcbiAgKVxuICAvLyBSZXRyaWV2ZSBsb3N0IG1lc3NhZ2VzIHN0b3JlZCBiZWNhdXNlIFBlZXJDb25uZWN0aW9uIG5vdCBzZXQgdXAuXG4gIHZhciBtZXNzYWdlcyA9IHRoaXMucHJvdmlkZXIuX2dldE1lc3NhZ2VzKHRoaXMuaWQpO1xuICBmb3IgKHZhciBpID0gMCwgaWkgPSBtZXNzYWdlcy5sZW5ndGg7IGkgPCBpaTsgaSArPSAxKSB7XG4gICAgdGhpcy5oYW5kbGVNZXNzYWdlKG1lc3NhZ2VzW2ldKTtcbiAgfVxuICB0aGlzLm9wZW4gPSB0cnVlO1xufTtcblxuLyoqXG4gKiBFeHBvc2VkIGZ1bmN0aW9uYWxpdHkgZm9yIHVzZXJzLlxuICovXG5cbi8qKiBBbGxvd3MgdXNlciB0byBjbG9zZSBjb25uZWN0aW9uLiAqL1xuTWVkaWFDb25uZWN0aW9uLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMub3Blbikge1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLm9wZW4gPSBmYWxzZTtcbiAgTmVnb3RpYXRvci5jbGVhbnVwKHRoaXMpO1xuICB0aGlzLmVtaXQoJ2Nsb3NlJylcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTWVkaWFDb25uZWN0aW9uO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBSVENQZWVyQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vYWRhcHRlcicpLlJUQ1BlZXJDb25uZWN0aW9uO1xudmFyIFJUQ1Nlc3Npb25EZXNjcmlwdGlvbiA9IHJlcXVpcmUoJy4vYWRhcHRlcicpLlJUQ1Nlc3Npb25EZXNjcmlwdGlvbjtcbnZhciBSVENJY2VDYW5kaWRhdGUgPSByZXF1aXJlKCcuL2FkYXB0ZXInKS5SVENJY2VDYW5kaWRhdGU7XG5cbi8qKlxuICogTWFuYWdlcyBhbGwgbmVnb3RpYXRpb25zIGJldHdlZW4gUGVlcnMuXG4gKi9cbnZhciBOZWdvdGlhdG9yID0ge1xuICBwY3M6IHtcbiAgICBkYXRhOiB7fSxcbiAgICBtZWRpYToge31cbiAgfSwgLy8gdHlwZSA9PiB7cGVlcklkOiB7cGNfaWQ6IHBjfX0uXG4gIC8vcHJvdmlkZXJzOiB7fSwgLy8gcHJvdmlkZXIncyBpZCA9PiBwcm92aWRlcnMgKHRoZXJlIG1heSBiZSBtdWx0aXBsZSBwcm92aWRlcnMvY2xpZW50LlxuICBxdWV1ZTogW10gLy8gY29ubmVjdGlvbnMgdGhhdCBhcmUgZGVsYXllZCBkdWUgdG8gYSBQQyBiZWluZyBpbiB1c2UuXG59XG5cbk5lZ290aWF0b3IuX2lkUHJlZml4ID0gJ3BjXyc7XG5cbi8qKiBSZXR1cm5zIGEgUGVlckNvbm5lY3Rpb24gb2JqZWN0IHNldCB1cCBjb3JyZWN0bHkgKGZvciBkYXRhLCBtZWRpYSkuICovXG5OZWdvdGlhdG9yLnN0YXJ0Q29ubmVjdGlvbiA9IGZ1bmN0aW9uKGNvbm5lY3Rpb24sIG9wdGlvbnMpIHtcbiAgdmFyIHBjID0gTmVnb3RpYXRvci5fZ2V0UGVlckNvbm5lY3Rpb24oY29ubmVjdGlvbiwgb3B0aW9ucyk7XG5cbiAgaWYgKGNvbm5lY3Rpb24udHlwZSA9PT0gJ21lZGlhJyAmJiBvcHRpb25zLl9zdHJlYW0pIHtcbiAgICAvLyBBZGQgdGhlIHN0cmVhbS5cbiAgICBwYy5hZGRTdHJlYW0ob3B0aW9ucy5fc3RyZWFtKTtcbiAgfVxuXG4gIC8vIFNldCB0aGUgY29ubmVjdGlvbidzIFBDLlxuICBjb25uZWN0aW9uLnBjID0gY29ubmVjdGlvbi5wZWVyQ29ubmVjdGlvbiA9IHBjO1xuICAvLyBXaGF0IGRvIHdlIG5lZWQgdG8gZG8gbm93P1xuICBpZiAob3B0aW9ucy5vcmlnaW5hdG9yKSB7XG4gICAgaWYgKGNvbm5lY3Rpb24udHlwZSA9PT0gJ2RhdGEnKSB7XG4gICAgICAvLyBDcmVhdGUgdGhlIGRhdGFjaGFubmVsLlxuICAgICAgdmFyIGNvbmZpZyA9IHt9O1xuICAgICAgLy8gRHJvcHBpbmcgcmVsaWFibGU6ZmFsc2Ugc3VwcG9ydCwgc2luY2UgaXQgc2VlbXMgdG8gYmUgY3Jhc2hpbmdcbiAgICAgIC8vIENocm9tZS5cbiAgICAgIC8qaWYgKHV0aWwuc3VwcG9ydHMuc2N0cCAmJiAhb3B0aW9ucy5yZWxpYWJsZSkge1xuICAgICAgICAvLyBJZiB3ZSBoYXZlIGNhbm9uaWNhbCByZWxpYWJsZSBzdXBwb3J0Li4uXG4gICAgICAgIGNvbmZpZyA9IHttYXhSZXRyYW5zbWl0czogMH07XG4gICAgICB9Ki9cbiAgICAgIC8vIEZhbGxiYWNrIHRvIGVuc3VyZSBvbGRlciBicm93c2VycyBkb24ndCBjcmFzaC5cbiAgICAgIGlmICghdXRpbC5zdXBwb3J0cy5zY3RwKSB7XG4gICAgICAgIGNvbmZpZyA9IHtyZWxpYWJsZTogb3B0aW9ucy5yZWxpYWJsZX07XG4gICAgICB9XG4gICAgICB2YXIgZGMgPSBwYy5jcmVhdGVEYXRhQ2hhbm5lbChjb25uZWN0aW9uLmxhYmVsLCBjb25maWcpO1xuICAgICAgY29ubmVjdGlvbi5pbml0aWFsaXplKGRjKTtcbiAgICB9XG5cbiAgICBpZiAoIXV0aWwuc3VwcG9ydHMub25uZWdvdGlhdGlvbm5lZWRlZCkge1xuICAgICAgTmVnb3RpYXRvci5fbWFrZU9mZmVyKGNvbm5lY3Rpb24pO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBOZWdvdGlhdG9yLmhhbmRsZVNEUCgnT0ZGRVInLCBjb25uZWN0aW9uLCBvcHRpb25zLnNkcCk7XG4gIH1cbn1cblxuTmVnb3RpYXRvci5fZ2V0UGVlckNvbm5lY3Rpb24gPSBmdW5jdGlvbihjb25uZWN0aW9uLCBvcHRpb25zKSB7XG4gIGlmICghTmVnb3RpYXRvci5wY3NbY29ubmVjdGlvbi50eXBlXSkge1xuICAgIHV0aWwuZXJyb3IoY29ubmVjdGlvbi50eXBlICsgJyBpcyBub3QgYSB2YWxpZCBjb25uZWN0aW9uIHR5cGUuIE1heWJlIHlvdSBvdmVycm9kZSB0aGUgYHR5cGVgIHByb3BlcnR5IHNvbWV3aGVyZS4nKTtcbiAgfVxuXG4gIGlmICghTmVnb3RpYXRvci5wY3NbY29ubmVjdGlvbi50eXBlXVtjb25uZWN0aW9uLnBlZXJdKSB7XG4gICAgTmVnb3RpYXRvci5wY3NbY29ubmVjdGlvbi50eXBlXVtjb25uZWN0aW9uLnBlZXJdID0ge307XG4gIH1cbiAgdmFyIHBlZXJDb25uZWN0aW9ucyA9IE5lZ290aWF0b3IucGNzW2Nvbm5lY3Rpb24udHlwZV1bY29ubmVjdGlvbi5wZWVyXTtcblxuICB2YXIgcGM7XG4gIC8vIE5vdCBtdWx0aXBsZXhpbmcgd2hpbGUgRkYgYW5kIENocm9tZSBoYXZlIG5vdC1ncmVhdCBzdXBwb3J0IGZvciBpdC5cbiAgLyppZiAob3B0aW9ucy5tdWx0aXBsZXgpIHtcbiAgICBpZHMgPSBPYmplY3Qua2V5cyhwZWVyQ29ubmVjdGlvbnMpO1xuICAgIGZvciAodmFyIGkgPSAwLCBpaSA9IGlkcy5sZW5ndGg7IGkgPCBpaTsgaSArPSAxKSB7XG4gICAgICBwYyA9IHBlZXJDb25uZWN0aW9uc1tpZHNbaV1dO1xuICAgICAgaWYgKHBjLnNpZ25hbGluZ1N0YXRlID09PSAnc3RhYmxlJykge1xuICAgICAgICBicmVhazsgLy8gV2UgY2FuIGdvIGFoZWFkIGFuZCB1c2UgdGhpcyBQQy5cbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSAqL1xuICBpZiAob3B0aW9ucy5wYykgeyAvLyBTaW1wbGVzdCBjYXNlOiBQQyBpZCBhbHJlYWR5IHByb3ZpZGVkIGZvciB1cy5cbiAgICBwYyA9IE5lZ290aWF0b3IucGNzW2Nvbm5lY3Rpb24udHlwZV1bY29ubmVjdGlvbi5wZWVyXVtvcHRpb25zLnBjXTtcbiAgfVxuXG4gIGlmICghcGMgfHwgcGMuc2lnbmFsaW5nU3RhdGUgIT09ICdzdGFibGUnKSB7XG4gICAgcGMgPSBOZWdvdGlhdG9yLl9zdGFydFBlZXJDb25uZWN0aW9uKGNvbm5lY3Rpb24pO1xuICB9XG4gIHJldHVybiBwYztcbn1cblxuLypcbk5lZ290aWF0b3IuX2FkZFByb3ZpZGVyID0gZnVuY3Rpb24ocHJvdmlkZXIpIHtcbiAgaWYgKCghcHJvdmlkZXIuaWQgJiYgIXByb3ZpZGVyLmRpc2Nvbm5lY3RlZCkgfHwgIXByb3ZpZGVyLnNvY2tldC5vcGVuKSB7XG4gICAgLy8gV2FpdCBmb3IgcHJvdmlkZXIgdG8gb2J0YWluIGFuIElELlxuICAgIHByb3ZpZGVyLm9uKCdvcGVuJywgZnVuY3Rpb24oaWQpIHtcbiAgICAgIE5lZ290aWF0b3IuX2FkZFByb3ZpZGVyKHByb3ZpZGVyKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBOZWdvdGlhdG9yLnByb3ZpZGVyc1twcm92aWRlci5pZF0gPSBwcm92aWRlcjtcbiAgfVxufSovXG5cblxuLyoqIFN0YXJ0IGEgUEMuICovXG5OZWdvdGlhdG9yLl9zdGFydFBlZXJDb25uZWN0aW9uID0gZnVuY3Rpb24oY29ubmVjdGlvbikge1xuICB1dGlsLmxvZygnQ3JlYXRpbmcgUlRDUGVlckNvbm5lY3Rpb24uJyk7XG5cbiAgdmFyIGlkID0gTmVnb3RpYXRvci5faWRQcmVmaXggKyB1dGlsLnJhbmRvbVRva2VuKCk7XG4gIHZhciBvcHRpb25hbCA9IHt9O1xuXG4gIGlmIChjb25uZWN0aW9uLnR5cGUgPT09ICdkYXRhJyAmJiAhdXRpbC5zdXBwb3J0cy5zY3RwKSB7XG4gICAgb3B0aW9uYWwgPSB7b3B0aW9uYWw6IFt7UnRwRGF0YUNoYW5uZWxzOiB0cnVlfV19O1xuICB9IGVsc2UgaWYgKGNvbm5lY3Rpb24udHlwZSA9PT0gJ21lZGlhJykge1xuICAgIC8vIEludGVyb3AgcmVxIGZvciBjaHJvbWUuXG4gICAgb3B0aW9uYWwgPSB7b3B0aW9uYWw6IFt7RHRsc1NydHBLZXlBZ3JlZW1lbnQ6IHRydWV9XX07XG4gIH1cblxuICB2YXIgcGMgPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24oY29ubmVjdGlvbi5wcm92aWRlci5vcHRpb25zLmNvbmZpZywgb3B0aW9uYWwpO1xuICBOZWdvdGlhdG9yLnBjc1tjb25uZWN0aW9uLnR5cGVdW2Nvbm5lY3Rpb24ucGVlcl1baWRdID0gcGM7XG5cbiAgTmVnb3RpYXRvci5fc2V0dXBMaXN0ZW5lcnMoY29ubmVjdGlvbiwgcGMsIGlkKTtcblxuICByZXR1cm4gcGM7XG59XG5cbi8qKiBTZXQgdXAgdmFyaW91cyBXZWJSVEMgbGlzdGVuZXJzLiAqL1xuTmVnb3RpYXRvci5fc2V0dXBMaXN0ZW5lcnMgPSBmdW5jdGlvbihjb25uZWN0aW9uLCBwYywgcGNfaWQpIHtcbiAgdmFyIHBlZXJJZCA9IGNvbm5lY3Rpb24ucGVlcjtcbiAgdmFyIGNvbm5lY3Rpb25JZCA9IGNvbm5lY3Rpb24uaWQ7XG4gIHZhciBwcm92aWRlciA9IGNvbm5lY3Rpb24ucHJvdmlkZXI7XG5cbiAgLy8gSUNFIENBTkRJREFURVMuXG4gIHV0aWwubG9nKCdMaXN0ZW5pbmcgZm9yIElDRSBjYW5kaWRhdGVzLicpO1xuICBwYy5vbmljZWNhbmRpZGF0ZSA9IGZ1bmN0aW9uKGV2dCkge1xuICAgIGlmIChldnQuY2FuZGlkYXRlKSB7XG4gICAgICB1dGlsLmxvZygnUmVjZWl2ZWQgSUNFIGNhbmRpZGF0ZXMgZm9yOicsIGNvbm5lY3Rpb24ucGVlcik7XG4gICAgICBwcm92aWRlci5zb2NrZXQuc2VuZCh7XG4gICAgICAgIHR5cGU6ICdDQU5ESURBVEUnLFxuICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgY2FuZGlkYXRlOiBldnQuY2FuZGlkYXRlLFxuICAgICAgICAgIHR5cGU6IGNvbm5lY3Rpb24udHlwZSxcbiAgICAgICAgICBjb25uZWN0aW9uSWQ6IGNvbm5lY3Rpb24uaWRcbiAgICAgICAgfSxcbiAgICAgICAgZHN0OiBwZWVySWRcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcblxuICBwYy5vbmljZWNvbm5lY3Rpb25zdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgIHN3aXRjaCAocGMuaWNlQ29ubmVjdGlvblN0YXRlKSB7XG4gICAgICBjYXNlICdkaXNjb25uZWN0ZWQnOlxuICAgICAgY2FzZSAnZmFpbGVkJzpcbiAgICAgICAgdXRpbC5sb2coJ2ljZUNvbm5lY3Rpb25TdGF0ZSBpcyBkaXNjb25uZWN0ZWQsIGNsb3NpbmcgY29ubmVjdGlvbnMgdG8gJyArIHBlZXJJZCk7XG4gICAgICAgIGNvbm5lY3Rpb24uY2xvc2UoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdjb21wbGV0ZWQnOlxuICAgICAgICBwYy5vbmljZWNhbmRpZGF0ZSA9IHV0aWwubm9vcDtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9O1xuXG4gIC8vIEZhbGxiYWNrIGZvciBvbGRlciBDaHJvbWUgaW1wbHMuXG4gIHBjLm9uaWNlY2hhbmdlID0gcGMub25pY2Vjb25uZWN0aW9uc3RhdGVjaGFuZ2U7XG5cbiAgLy8gT05ORUdPVElBVElPTk5FRURFRCAoQ2hyb21lKVxuICB1dGlsLmxvZygnTGlzdGVuaW5nIGZvciBgbmVnb3RpYXRpb25uZWVkZWRgJyk7XG4gIHBjLm9ubmVnb3RpYXRpb25uZWVkZWQgPSBmdW5jdGlvbigpIHtcbiAgICB1dGlsLmxvZygnYG5lZ290aWF0aW9ubmVlZGVkYCB0cmlnZ2VyZWQnKTtcbiAgICBpZiAocGMuc2lnbmFsaW5nU3RhdGUgPT0gJ3N0YWJsZScpIHtcbiAgICAgIE5lZ290aWF0b3IuX21ha2VPZmZlcihjb25uZWN0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXRpbC5sb2coJ29ubmVnb3RpYXRpb25uZWVkZWQgdHJpZ2dlcmVkIHdoZW4gbm90IHN0YWJsZS4gSXMgYW5vdGhlciBjb25uZWN0aW9uIGJlaW5nIGVzdGFibGlzaGVkPycpO1xuICAgIH1cbiAgfTtcblxuICAvLyBEQVRBQ09OTkVDVElPTi5cbiAgdXRpbC5sb2coJ0xpc3RlbmluZyBmb3IgZGF0YSBjaGFubmVsJyk7XG4gIC8vIEZpcmVkIGJldHdlZW4gb2ZmZXIgYW5kIGFuc3dlciwgc28gb3B0aW9ucyBzaG91bGQgYWxyZWFkeSBiZSBzYXZlZFxuICAvLyBpbiB0aGUgb3B0aW9ucyBoYXNoLlxuICBwYy5vbmRhdGFjaGFubmVsID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgdXRpbC5sb2coJ1JlY2VpdmVkIGRhdGEgY2hhbm5lbCcpO1xuICAgIHZhciBkYyA9IGV2dC5jaGFubmVsO1xuICAgIHZhciBjb25uZWN0aW9uID0gcHJvdmlkZXIuZ2V0Q29ubmVjdGlvbihwZWVySWQsIGNvbm5lY3Rpb25JZCk7XG4gICAgY29ubmVjdGlvbi5pbml0aWFsaXplKGRjKTtcbiAgfTtcblxuICAvLyBNRURJQUNPTk5FQ1RJT04uXG4gIHV0aWwubG9nKCdMaXN0ZW5pbmcgZm9yIHJlbW90ZSBzdHJlYW0nKTtcbiAgcGMub25hZGRzdHJlYW0gPSBmdW5jdGlvbihldnQpIHtcbiAgICB1dGlsLmxvZygnUmVjZWl2ZWQgcmVtb3RlIHN0cmVhbScpO1xuICAgIHZhciBzdHJlYW0gPSBldnQuc3RyZWFtO1xuICAgIHZhciBjb25uZWN0aW9uID0gcHJvdmlkZXIuZ2V0Q29ubmVjdGlvbihwZWVySWQsIGNvbm5lY3Rpb25JZCk7XG4gICAgLy8gMTAvMTAvMjAxNDogbG9va3MgbGlrZSBpbiBDaHJvbWUgMzgsIG9uYWRkc3RyZWFtIGlzIHRyaWdnZXJlZCBhZnRlclxuICAgIC8vIHNldHRpbmcgdGhlIHJlbW90ZSBkZXNjcmlwdGlvbi4gT3VyIGNvbm5lY3Rpb24gb2JqZWN0IGluIHRoZXNlIGNhc2VzXG4gICAgLy8gaXMgYWN0dWFsbHkgYSBEQVRBIGNvbm5lY3Rpb24sIHNvIGFkZFN0cmVhbSBmYWlscy5cbiAgICAvLyBUT0RPOiBUaGlzIGlzIGhvcGVmdWxseSBqdXN0IGEgdGVtcG9yYXJ5IGZpeC4gV2Ugc2hvdWxkIHRyeSB0b1xuICAgIC8vIHVuZGVyc3RhbmQgd2h5IHRoaXMgaXMgaGFwcGVuaW5nLlxuICAgIGlmIChjb25uZWN0aW9uLnR5cGUgPT09ICdtZWRpYScpIHtcbiAgICAgIGNvbm5lY3Rpb24uYWRkU3RyZWFtKHN0cmVhbSk7XG4gICAgfVxuICB9O1xufVxuXG5OZWdvdGlhdG9yLmNsZWFudXAgPSBmdW5jdGlvbihjb25uZWN0aW9uKSB7XG4gIHV0aWwubG9nKCdDbGVhbmluZyB1cCBQZWVyQ29ubmVjdGlvbiB0byAnICsgY29ubmVjdGlvbi5wZWVyKTtcblxuICB2YXIgcGMgPSBjb25uZWN0aW9uLnBjO1xuXG4gIGlmICghIXBjICYmIChwYy5yZWFkeVN0YXRlICE9PSAnY2xvc2VkJyB8fCBwYy5zaWduYWxpbmdTdGF0ZSAhPT0gJ2Nsb3NlZCcpKSB7XG4gICAgcGMuY2xvc2UoKTtcbiAgICBjb25uZWN0aW9uLnBjID0gbnVsbDtcbiAgfVxufVxuXG5OZWdvdGlhdG9yLl9tYWtlT2ZmZXIgPSBmdW5jdGlvbihjb25uZWN0aW9uKSB7XG4gIHZhciBwYyA9IGNvbm5lY3Rpb24ucGM7XG4gIHBjLmNyZWF0ZU9mZmVyKGZ1bmN0aW9uKG9mZmVyKSB7XG4gICAgdXRpbC5sb2coJ0NyZWF0ZWQgb2ZmZXIuJyk7XG5cbiAgICBpZiAoIXV0aWwuc3VwcG9ydHMuc2N0cCAmJiBjb25uZWN0aW9uLnR5cGUgPT09ICdkYXRhJyAmJiBjb25uZWN0aW9uLnJlbGlhYmxlKSB7XG4gICAgICBvZmZlci5zZHAgPSBSZWxpYWJsZS5oaWdoZXJCYW5kd2lkdGhTRFAob2ZmZXIuc2RwKTtcbiAgICB9XG5cbiAgICBwYy5zZXRMb2NhbERlc2NyaXB0aW9uKG9mZmVyLCBmdW5jdGlvbigpIHtcbiAgICAgIHV0aWwubG9nKCdTZXQgbG9jYWxEZXNjcmlwdGlvbjogb2ZmZXInLCAnZm9yOicsIGNvbm5lY3Rpb24ucGVlcik7XG4gICAgICBjb25uZWN0aW9uLnByb3ZpZGVyLnNvY2tldC5zZW5kKHtcbiAgICAgICAgdHlwZTogJ09GRkVSJyxcbiAgICAgICAgcGF5bG9hZDoge1xuICAgICAgICAgIHNkcDogb2ZmZXIsXG4gICAgICAgICAgdHlwZTogY29ubmVjdGlvbi50eXBlLFxuICAgICAgICAgIGxhYmVsOiBjb25uZWN0aW9uLmxhYmVsLFxuICAgICAgICAgIGNvbm5lY3Rpb25JZDogY29ubmVjdGlvbi5pZCxcbiAgICAgICAgICByZWxpYWJsZTogY29ubmVjdGlvbi5yZWxpYWJsZSxcbiAgICAgICAgICBzZXJpYWxpemF0aW9uOiBjb25uZWN0aW9uLnNlcmlhbGl6YXRpb24sXG4gICAgICAgICAgbWV0YWRhdGE6IGNvbm5lY3Rpb24ubWV0YWRhdGEsXG4gICAgICAgICAgYnJvd3NlcjogdXRpbC5icm93c2VyXG4gICAgICAgIH0sXG4gICAgICAgIGRzdDogY29ubmVjdGlvbi5wZWVyXG4gICAgICB9KTtcbiAgICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICAgIGNvbm5lY3Rpb24ucHJvdmlkZXIuZW1pdEVycm9yKCd3ZWJydGMnLCBlcnIpO1xuICAgICAgdXRpbC5sb2coJ0ZhaWxlZCB0byBzZXRMb2NhbERlc2NyaXB0aW9uLCAnLCBlcnIpO1xuICAgIH0pO1xuICB9LCBmdW5jdGlvbihlcnIpIHtcbiAgICBjb25uZWN0aW9uLnByb3ZpZGVyLmVtaXRFcnJvcignd2VicnRjJywgZXJyKTtcbiAgICB1dGlsLmxvZygnRmFpbGVkIHRvIGNyZWF0ZU9mZmVyLCAnLCBlcnIpO1xuICB9LCBjb25uZWN0aW9uLm9wdGlvbnMuY29uc3RyYWludHMpO1xufVxuXG5OZWdvdGlhdG9yLl9tYWtlQW5zd2VyID0gZnVuY3Rpb24oY29ubmVjdGlvbikge1xuICB2YXIgcGMgPSBjb25uZWN0aW9uLnBjO1xuXG4gIHBjLmNyZWF0ZUFuc3dlcihmdW5jdGlvbihhbnN3ZXIpIHtcbiAgICB1dGlsLmxvZygnQ3JlYXRlZCBhbnN3ZXIuJyk7XG5cbiAgICBpZiAoIXV0aWwuc3VwcG9ydHMuc2N0cCAmJiBjb25uZWN0aW9uLnR5cGUgPT09ICdkYXRhJyAmJiBjb25uZWN0aW9uLnJlbGlhYmxlKSB7XG4gICAgICBhbnN3ZXIuc2RwID0gUmVsaWFibGUuaGlnaGVyQmFuZHdpZHRoU0RQKGFuc3dlci5zZHApO1xuICAgIH1cblxuICAgIHBjLnNldExvY2FsRGVzY3JpcHRpb24oYW5zd2VyLCBmdW5jdGlvbigpIHtcbiAgICAgIHV0aWwubG9nKCdTZXQgbG9jYWxEZXNjcmlwdGlvbjogYW5zd2VyJywgJ2ZvcjonLCBjb25uZWN0aW9uLnBlZXIpO1xuICAgICAgY29ubmVjdGlvbi5wcm92aWRlci5zb2NrZXQuc2VuZCh7XG4gICAgICAgIHR5cGU6ICdBTlNXRVInLFxuICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgc2RwOiBhbnN3ZXIsXG4gICAgICAgICAgdHlwZTogY29ubmVjdGlvbi50eXBlLFxuICAgICAgICAgIGNvbm5lY3Rpb25JZDogY29ubmVjdGlvbi5pZCxcbiAgICAgICAgICBicm93c2VyOiB1dGlsLmJyb3dzZXJcbiAgICAgICAgfSxcbiAgICAgICAgZHN0OiBjb25uZWN0aW9uLnBlZXJcbiAgICAgIH0pO1xuICAgIH0sIGZ1bmN0aW9uKGVycikge1xuICAgICAgY29ubmVjdGlvbi5wcm92aWRlci5lbWl0RXJyb3IoJ3dlYnJ0YycsIGVycik7XG4gICAgICB1dGlsLmxvZygnRmFpbGVkIHRvIHNldExvY2FsRGVzY3JpcHRpb24sICcsIGVycik7XG4gICAgfSk7XG4gIH0sIGZ1bmN0aW9uKGVycikge1xuICAgIGNvbm5lY3Rpb24ucHJvdmlkZXIuZW1pdEVycm9yKCd3ZWJydGMnLCBlcnIpO1xuICAgIHV0aWwubG9nKCdGYWlsZWQgdG8gY3JlYXRlIGFuc3dlciwgJywgZXJyKTtcbiAgfSk7XG59XG5cbi8qKiBIYW5kbGUgYW4gU0RQLiAqL1xuTmVnb3RpYXRvci5oYW5kbGVTRFAgPSBmdW5jdGlvbih0eXBlLCBjb25uZWN0aW9uLCBzZHApIHtcbiAgc2RwID0gbmV3IFJUQ1Nlc3Npb25EZXNjcmlwdGlvbihzZHApO1xuICB2YXIgcGMgPSBjb25uZWN0aW9uLnBjO1xuXG4gIHV0aWwubG9nKCdTZXR0aW5nIHJlbW90ZSBkZXNjcmlwdGlvbicsIHNkcCk7XG4gIHBjLnNldFJlbW90ZURlc2NyaXB0aW9uKHNkcCwgZnVuY3Rpb24oKSB7XG4gICAgdXRpbC5sb2coJ1NldCByZW1vdGVEZXNjcmlwdGlvbjonLCB0eXBlLCAnZm9yOicsIGNvbm5lY3Rpb24ucGVlcik7XG5cbiAgICBpZiAodHlwZSA9PT0gJ09GRkVSJykge1xuICAgICAgTmVnb3RpYXRvci5fbWFrZUFuc3dlcihjb25uZWN0aW9uKTtcbiAgICB9XG4gIH0sIGZ1bmN0aW9uKGVycikge1xuICAgIGNvbm5lY3Rpb24ucHJvdmlkZXIuZW1pdEVycm9yKCd3ZWJydGMnLCBlcnIpO1xuICAgIHV0aWwubG9nKCdGYWlsZWQgdG8gc2V0UmVtb3RlRGVzY3JpcHRpb24sICcsIGVycik7XG4gIH0pO1xufVxuXG4vKiogSGFuZGxlIGEgY2FuZGlkYXRlLiAqL1xuTmVnb3RpYXRvci5oYW5kbGVDYW5kaWRhdGUgPSBmdW5jdGlvbihjb25uZWN0aW9uLCBpY2UpIHtcbiAgdmFyIGNhbmRpZGF0ZSA9IGljZS5jYW5kaWRhdGU7XG4gIHZhciBzZHBNTGluZUluZGV4ID0gaWNlLnNkcE1MaW5lSW5kZXg7XG4gIGNvbm5lY3Rpb24ucGMuYWRkSWNlQ2FuZGlkYXRlKG5ldyBSVENJY2VDYW5kaWRhdGUoe1xuICAgIHNkcE1MaW5lSW5kZXg6IHNkcE1MaW5lSW5kZXgsXG4gICAgY2FuZGlkYXRlOiBjYW5kaWRhdGVcbiAgfSkpO1xuICB1dGlsLmxvZygnQWRkZWQgSUNFIGNhbmRpZGF0ZSBmb3I6JywgY29ubmVjdGlvbi5wZWVyKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBOZWdvdGlhdG9yO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIzJyk7XG52YXIgU29ja2V0ID0gcmVxdWlyZSgnLi9zb2NrZXQnKTtcbnZhciBNZWRpYUNvbm5lY3Rpb24gPSByZXF1aXJlKCcuL21lZGlhY29ubmVjdGlvbicpO1xudmFyIERhdGFDb25uZWN0aW9uID0gcmVxdWlyZSgnLi9kYXRhY29ubmVjdGlvbicpO1xuXG4vKipcbiAqIEEgcGVlciB3aG8gY2FuIGluaXRpYXRlIGNvbm5lY3Rpb25zIHdpdGggb3RoZXIgcGVlcnMuXG4gKi9cbmZ1bmN0aW9uIFBlZXIoaWQsIG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFBlZXIpKSByZXR1cm4gbmV3IFBlZXIoaWQsIG9wdGlvbnMpO1xuICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAvLyBEZWFsIHdpdGggb3ZlcmxvYWRpbmdcbiAgaWYgKGlkICYmIGlkLmNvbnN0cnVjdG9yID09IE9iamVjdCkge1xuICAgIG9wdGlvbnMgPSBpZDtcbiAgICBpZCA9IHVuZGVmaW5lZDtcbiAgfSBlbHNlIGlmIChpZCkge1xuICAgIC8vIEVuc3VyZSBpZCBpcyBhIHN0cmluZ1xuICAgIGlkID0gaWQudG9TdHJpbmcoKTtcbiAgfVxuICAvL1xuXG4gIC8vIENvbmZpZ3VyaXplIG9wdGlvbnNcbiAgb3B0aW9ucyA9IHV0aWwuZXh0ZW5kKHtcbiAgICBkZWJ1ZzogMCwgLy8gMTogRXJyb3JzLCAyOiBXYXJuaW5ncywgMzogQWxsIGxvZ3NcbiAgICBob3N0OiB1dGlsLkNMT1VEX0hPU1QsXG4gICAgcG9ydDogdXRpbC5DTE9VRF9QT1JULFxuICAgIGtleTogJ3BlZXJqcycsXG4gICAgcGF0aDogJy8nLFxuICAgIHRva2VuOiB1dGlsLnJhbmRvbVRva2VuKCksXG4gICAgY29uZmlnOiB1dGlsLmRlZmF1bHRDb25maWdcbiAgfSwgb3B0aW9ucyk7XG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gIC8vIERldGVjdCByZWxhdGl2ZSBVUkwgaG9zdC5cbiAgaWYgKG9wdGlvbnMuaG9zdCA9PT0gJy8nKSB7XG4gICAgb3B0aW9ucy5ob3N0ID0gd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lO1xuICB9XG4gIC8vIFNldCBwYXRoIGNvcnJlY3RseS5cbiAgaWYgKG9wdGlvbnMucGF0aFswXSAhPT0gJy8nKSB7XG4gICAgb3B0aW9ucy5wYXRoID0gJy8nICsgb3B0aW9ucy5wYXRoO1xuICB9XG4gIGlmIChvcHRpb25zLnBhdGhbb3B0aW9ucy5wYXRoLmxlbmd0aCAtIDFdICE9PSAnLycpIHtcbiAgICBvcHRpb25zLnBhdGggKz0gJy8nO1xuICB9XG5cbiAgLy8gU2V0IHdoZXRoZXIgd2UgdXNlIFNTTCB0byBzYW1lIGFzIGN1cnJlbnQgaG9zdFxuICBpZiAob3B0aW9ucy5zZWN1cmUgPT09IHVuZGVmaW5lZCAmJiBvcHRpb25zLmhvc3QgIT09IHV0aWwuQ0xPVURfSE9TVCkge1xuICAgIG9wdGlvbnMuc2VjdXJlID0gdXRpbC5pc1NlY3VyZSgpO1xuICB9XG4gIC8vIFNldCBhIGN1c3RvbSBsb2cgZnVuY3Rpb24gaWYgcHJlc2VudFxuICBpZiAob3B0aW9ucy5sb2dGdW5jdGlvbikge1xuICAgIHV0aWwuc2V0TG9nRnVuY3Rpb24ob3B0aW9ucy5sb2dGdW5jdGlvbik7XG4gIH1cbiAgdXRpbC5zZXRMb2dMZXZlbChvcHRpb25zLmRlYnVnKTtcbiAgLy9cblxuICAvLyBTYW5pdHkgY2hlY2tzXG4gIC8vIEVuc3VyZSBXZWJSVEMgc3VwcG9ydGVkXG4gIGlmICghdXRpbC5zdXBwb3J0cy5hdWRpb1ZpZGVvICYmICF1dGlsLnN1cHBvcnRzLmRhdGEgKSB7XG4gICAgdGhpcy5fZGVsYXllZEFib3J0KCdicm93c2VyLWluY29tcGF0aWJsZScsICdUaGUgY3VycmVudCBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgV2ViUlRDJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIEVuc3VyZSBhbHBoYW51bWVyaWMgaWRcbiAgaWYgKCF1dGlsLnZhbGlkYXRlSWQoaWQpKSB7XG4gICAgdGhpcy5fZGVsYXllZEFib3J0KCdpbnZhbGlkLWlkJywgJ0lEIFwiJyArIGlkICsgJ1wiIGlzIGludmFsaWQnKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gRW5zdXJlIHZhbGlkIGtleVxuICBpZiAoIXV0aWwudmFsaWRhdGVLZXkob3B0aW9ucy5rZXkpKSB7XG4gICAgdGhpcy5fZGVsYXllZEFib3J0KCdpbnZhbGlkLWtleScsICdBUEkgS0VZIFwiJyArIG9wdGlvbnMua2V5ICsgJ1wiIGlzIGludmFsaWQnKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gRW5zdXJlIG5vdCB1c2luZyB1bnNlY3VyZSBjbG91ZCBzZXJ2ZXIgb24gU1NMIHBhZ2VcbiAgaWYgKG9wdGlvbnMuc2VjdXJlICYmIG9wdGlvbnMuaG9zdCA9PT0gJzAucGVlcmpzLmNvbScpIHtcbiAgICB0aGlzLl9kZWxheWVkQWJvcnQoJ3NzbC11bmF2YWlsYWJsZScsXG4gICAgICAnVGhlIGNsb3VkIHNlcnZlciBjdXJyZW50bHkgZG9lcyBub3Qgc3VwcG9ydCBIVFRQUy4gUGxlYXNlIHJ1biB5b3VyIG93biBQZWVyU2VydmVyIHRvIHVzZSBIVFRQUy4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy9cblxuICAvLyBTdGF0ZXMuXG4gIHRoaXMuZGVzdHJveWVkID0gZmFsc2U7IC8vIENvbm5lY3Rpb25zIGhhdmUgYmVlbiBraWxsZWRcbiAgdGhpcy5kaXNjb25uZWN0ZWQgPSBmYWxzZTsgLy8gQ29ubmVjdGlvbiB0byBQZWVyU2VydmVyIGtpbGxlZCBidXQgUDJQIGNvbm5lY3Rpb25zIHN0aWxsIGFjdGl2ZVxuICB0aGlzLm9wZW4gPSBmYWxzZTsgLy8gU29ja2V0cyBhbmQgc3VjaCBhcmUgbm90IHlldCBvcGVuLlxuICAvL1xuXG4gIC8vIFJlZmVyZW5jZXNcbiAgdGhpcy5jb25uZWN0aW9ucyA9IHt9OyAvLyBEYXRhQ29ubmVjdGlvbnMgZm9yIHRoaXMgcGVlci5cbiAgdGhpcy5fbG9zdE1lc3NhZ2VzID0ge307IC8vIHNyYyA9PiBbbGlzdCBvZiBtZXNzYWdlc11cbiAgLy9cblxuICAvLyBTdGFydCB0aGUgc2VydmVyIGNvbm5lY3Rpb25cbiAgdGhpcy5faW5pdGlhbGl6ZVNlcnZlckNvbm5lY3Rpb24oKTtcbiAgaWYgKGlkKSB7XG4gICAgdGhpcy5faW5pdGlhbGl6ZShpZCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fcmV0cmlldmVJZCgpO1xuICB9XG4gIC8vXG59XG5cbnV0aWwuaW5oZXJpdHMoUGVlciwgRXZlbnRFbWl0dGVyKTtcblxuLy8gSW5pdGlhbGl6ZSB0aGUgJ3NvY2tldCcgKHdoaWNoIGlzIGFjdHVhbGx5IGEgbWl4IG9mIFhIUiBzdHJlYW1pbmcgYW5kXG4vLyB3ZWJzb2NrZXRzLilcblBlZXIucHJvdG90eXBlLl9pbml0aWFsaXplU2VydmVyQ29ubmVjdGlvbiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMuc29ja2V0ID0gbmV3IFNvY2tldCh0aGlzLm9wdGlvbnMuc2VjdXJlLCB0aGlzLm9wdGlvbnMuaG9zdCwgdGhpcy5vcHRpb25zLnBvcnQsIHRoaXMub3B0aW9ucy5wYXRoLCB0aGlzLm9wdGlvbnMua2V5KTtcbiAgdGhpcy5zb2NrZXQub24oJ21lc3NhZ2UnLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgc2VsZi5faGFuZGxlTWVzc2FnZShkYXRhKTtcbiAgfSk7XG4gIHRoaXMuc29ja2V0Lm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgc2VsZi5fYWJvcnQoJ3NvY2tldC1lcnJvcicsIGVycm9yKTtcbiAgfSk7XG4gIHRoaXMuc29ja2V0Lm9uKCdkaXNjb25uZWN0ZWQnLCBmdW5jdGlvbigpIHtcbiAgICAvLyBJZiB3ZSBoYXZlbid0IGV4cGxpY2l0bHkgZGlzY29ubmVjdGVkLCBlbWl0IGVycm9yIGFuZCBkaXNjb25uZWN0LlxuICAgIGlmICghc2VsZi5kaXNjb25uZWN0ZWQpIHtcbiAgICAgIHNlbGYuZW1pdEVycm9yKCduZXR3b3JrJywgJ0xvc3QgY29ubmVjdGlvbiB0byBzZXJ2ZXIuJyk7XG4gICAgICBzZWxmLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG4gIH0pO1xuICB0aGlzLnNvY2tldC5vbignY2xvc2UnLCBmdW5jdGlvbigpIHtcbiAgICAvLyBJZiB3ZSBoYXZlbid0IGV4cGxpY2l0bHkgZGlzY29ubmVjdGVkLCBlbWl0IGVycm9yLlxuICAgIGlmICghc2VsZi5kaXNjb25uZWN0ZWQpIHtcbiAgICAgIHNlbGYuX2Fib3J0KCdzb2NrZXQtY2xvc2VkJywgJ1VuZGVybHlpbmcgc29ja2V0IGlzIGFscmVhZHkgY2xvc2VkLicpO1xuICAgIH1cbiAgfSk7XG59O1xuXG4vKiogR2V0IGEgdW5pcXVlIElEIGZyb20gdGhlIHNlcnZlciB2aWEgWEhSLiAqL1xuUGVlci5wcm90b3R5cGUuX3JldHJpZXZlSWQgPSBmdW5jdGlvbihjYikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIHZhciBwcm90b2NvbCA9IHRoaXMub3B0aW9ucy5zZWN1cmUgPyAnaHR0cHM6Ly8nIDogJ2h0dHA6Ly8nO1xuICB2YXIgdXJsID0gcHJvdG9jb2wgKyB0aGlzLm9wdGlvbnMuaG9zdCArICc6JyArIHRoaXMub3B0aW9ucy5wb3J0ICtcbiAgICB0aGlzLm9wdGlvbnMucGF0aCArIHRoaXMub3B0aW9ucy5rZXkgKyAnL2lkJztcbiAgdmFyIHF1ZXJ5U3RyaW5nID0gJz90cz0nICsgbmV3IERhdGUoKS5nZXRUaW1lKCkgKyAnJyArIE1hdGgucmFuZG9tKCk7XG4gIHVybCArPSBxdWVyeVN0cmluZztcblxuICAvLyBJZiB0aGVyZSdzIG5vIElEIHdlIG5lZWQgdG8gd2FpdCBmb3Igb25lIGJlZm9yZSB0cnlpbmcgdG8gaW5pdCBzb2NrZXQuXG4gIGh0dHAub3BlbignZ2V0JywgdXJsLCB0cnVlKTtcbiAgaHR0cC5vbmVycm9yID0gZnVuY3Rpb24oZSkge1xuICAgIHV0aWwuZXJyb3IoJ0Vycm9yIHJldHJpZXZpbmcgSUQnLCBlKTtcbiAgICB2YXIgcGF0aEVycm9yID0gJyc7XG4gICAgaWYgKHNlbGYub3B0aW9ucy5wYXRoID09PSAnLycgJiYgc2VsZi5vcHRpb25zLmhvc3QgIT09IHV0aWwuQ0xPVURfSE9TVCkge1xuICAgICAgcGF0aEVycm9yID0gJyBJZiB5b3UgcGFzc2VkIGluIGEgYHBhdGhgIHRvIHlvdXIgc2VsZi1ob3N0ZWQgUGVlclNlcnZlciwgJyArXG4gICAgICAgICd5b3VcXCdsbCBhbHNvIG5lZWQgdG8gcGFzcyBpbiB0aGF0IHNhbWUgcGF0aCB3aGVuIGNyZWF0aW5nIGEgbmV3ICcgK1xuICAgICAgICAnUGVlci4nO1xuICAgIH1cbiAgICBzZWxmLl9hYm9ydCgnc2VydmVyLWVycm9yJywgJ0NvdWxkIG5vdCBnZXQgYW4gSUQgZnJvbSB0aGUgc2VydmVyLicgKyBwYXRoRXJyb3IpO1xuICB9O1xuICBodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChodHRwLnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGh0dHAuc3RhdHVzICE9PSAyMDApIHtcbiAgICAgIGh0dHAub25lcnJvcigpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZWxmLl9pbml0aWFsaXplKGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgfTtcbiAgaHR0cC5zZW5kKG51bGwpO1xufTtcblxuLyoqIEluaXRpYWxpemUgYSBjb25uZWN0aW9uIHdpdGggdGhlIHNlcnZlci4gKi9cblBlZXIucHJvdG90eXBlLl9pbml0aWFsaXplID0gZnVuY3Rpb24oaWQpIHtcbiAgdGhpcy5pZCA9IGlkO1xuICB0aGlzLnNvY2tldC5zdGFydCh0aGlzLmlkLCB0aGlzLm9wdGlvbnMudG9rZW4pO1xufTtcblxuLyoqIEhhbmRsZXMgbWVzc2FnZXMgZnJvbSB0aGUgc2VydmVyLiAqL1xuUGVlci5wcm90b3R5cGUuX2hhbmRsZU1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gIHZhciB0eXBlID0gbWVzc2FnZS50eXBlO1xuICB2YXIgcGF5bG9hZCA9IG1lc3NhZ2UucGF5bG9hZDtcbiAgdmFyIHBlZXIgPSBtZXNzYWdlLnNyYztcbiAgdmFyIGNvbm5lY3Rpb247XG5cbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSAnT1BFTic6IC8vIFRoZSBjb25uZWN0aW9uIHRvIHRoZSBzZXJ2ZXIgaXMgb3Blbi5cbiAgICAgIHRoaXMuZW1pdCgnb3BlbicsIHRoaXMuaWQpO1xuICAgICAgdGhpcy5vcGVuID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0VSUk9SJzogLy8gU2VydmVyIGVycm9yLlxuICAgICAgdGhpcy5fYWJvcnQoJ3NlcnZlci1lcnJvcicsIHBheWxvYWQubXNnKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0lELVRBS0VOJzogLy8gVGhlIHNlbGVjdGVkIElEIGlzIHRha2VuLlxuICAgICAgdGhpcy5fYWJvcnQoJ3VuYXZhaWxhYmxlLWlkJywgJ0lEIGAnICsgdGhpcy5pZCArICdgIGlzIHRha2VuJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdJTlZBTElELUtFWSc6IC8vIFRoZSBnaXZlbiBBUEkga2V5IGNhbm5vdCBiZSBmb3VuZC5cbiAgICAgIHRoaXMuX2Fib3J0KCdpbnZhbGlkLWtleScsICdBUEkgS0VZIFwiJyArIHRoaXMub3B0aW9ucy5rZXkgKyAnXCIgaXMgaW52YWxpZCcpO1xuICAgICAgYnJlYWs7XG5cbiAgICAvL1xuICAgIGNhc2UgJ0xFQVZFJzogLy8gQW5vdGhlciBwZWVyIGhhcyBjbG9zZWQgaXRzIGNvbm5lY3Rpb24gdG8gdGhpcyBwZWVyLlxuICAgICAgdXRpbC5sb2coJ1JlY2VpdmVkIGxlYXZlIG1lc3NhZ2UgZnJvbScsIHBlZXIpO1xuICAgICAgdGhpcy5fY2xlYW51cFBlZXIocGVlcik7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ0VYUElSRSc6IC8vIFRoZSBvZmZlciBzZW50IHRvIGEgcGVlciBoYXMgZXhwaXJlZCB3aXRob3V0IHJlc3BvbnNlLlxuICAgICAgdGhpcy5lbWl0RXJyb3IoJ3BlZXItdW5hdmFpbGFibGUnLCAnQ291bGQgbm90IGNvbm5lY3QgdG8gcGVlciAnICsgcGVlcik7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdPRkZFUic6IC8vIHdlIHNob3VsZCBjb25zaWRlciBzd2l0Y2hpbmcgdGhpcyB0byBDQUxML0NPTk5FQ1QsIGJ1dCB0aGlzIGlzIHRoZSBsZWFzdCBicmVha2luZyBvcHRpb24uXG4gICAgICB2YXIgY29ubmVjdGlvbklkID0gcGF5bG9hZC5jb25uZWN0aW9uSWQ7XG4gICAgICBjb25uZWN0aW9uID0gdGhpcy5nZXRDb25uZWN0aW9uKHBlZXIsIGNvbm5lY3Rpb25JZCk7XG5cbiAgICAgIGlmIChjb25uZWN0aW9uKSB7XG4gICAgICAgIHV0aWwud2FybignT2ZmZXIgcmVjZWl2ZWQgZm9yIGV4aXN0aW5nIENvbm5lY3Rpb24gSUQ6JywgY29ubmVjdGlvbklkKTtcbiAgICAgICAgLy9jb25uZWN0aW9uLmhhbmRsZU1lc3NhZ2UobWVzc2FnZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBDcmVhdGUgYSBuZXcgY29ubmVjdGlvbi5cbiAgICAgICAgaWYgKHBheWxvYWQudHlwZSA9PT0gJ21lZGlhJykge1xuICAgICAgICAgIGNvbm5lY3Rpb24gPSBuZXcgTWVkaWFDb25uZWN0aW9uKHBlZXIsIHRoaXMsIHtcbiAgICAgICAgICAgIGNvbm5lY3Rpb25JZDogY29ubmVjdGlvbklkLFxuICAgICAgICAgICAgX3BheWxvYWQ6IHBheWxvYWQsXG4gICAgICAgICAgICBtZXRhZGF0YTogcGF5bG9hZC5tZXRhZGF0YVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMuX2FkZENvbm5lY3Rpb24ocGVlciwgY29ubmVjdGlvbik7XG4gICAgICAgICAgdGhpcy5lbWl0KCdjYWxsJywgY29ubmVjdGlvbik7XG4gICAgICAgIH0gZWxzZSBpZiAocGF5bG9hZC50eXBlID09PSAnZGF0YScpIHtcbiAgICAgICAgICBjb25uZWN0aW9uID0gbmV3IERhdGFDb25uZWN0aW9uKHBlZXIsIHRoaXMsIHtcbiAgICAgICAgICAgIGNvbm5lY3Rpb25JZDogY29ubmVjdGlvbklkLFxuICAgICAgICAgICAgX3BheWxvYWQ6IHBheWxvYWQsXG4gICAgICAgICAgICBtZXRhZGF0YTogcGF5bG9hZC5tZXRhZGF0YSxcbiAgICAgICAgICAgIGxhYmVsOiBwYXlsb2FkLmxhYmVsLFxuICAgICAgICAgICAgc2VyaWFsaXphdGlvbjogcGF5bG9hZC5zZXJpYWxpemF0aW9uLFxuICAgICAgICAgICAgcmVsaWFibGU6IHBheWxvYWQucmVsaWFibGVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLl9hZGRDb25uZWN0aW9uKHBlZXIsIGNvbm5lY3Rpb24pO1xuICAgICAgICAgIHRoaXMuZW1pdCgnY29ubmVjdGlvbicsIGNvbm5lY3Rpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHV0aWwud2FybignUmVjZWl2ZWQgbWFsZm9ybWVkIGNvbm5lY3Rpb24gdHlwZTonLCBwYXlsb2FkLnR5cGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBGaW5kIG1lc3NhZ2VzLlxuICAgICAgICB2YXIgbWVzc2FnZXMgPSB0aGlzLl9nZXRNZXNzYWdlcyhjb25uZWN0aW9uSWQpO1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgaWkgPSBtZXNzYWdlcy5sZW5ndGg7IGkgPCBpaTsgaSArPSAxKSB7XG4gICAgICAgICAgY29ubmVjdGlvbi5oYW5kbGVNZXNzYWdlKG1lc3NhZ2VzW2ldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIGlmICghcGF5bG9hZCkge1xuICAgICAgICB1dGlsLndhcm4oJ1lvdSByZWNlaXZlZCBhIG1hbGZvcm1lZCBtZXNzYWdlIGZyb20gJyArIHBlZXIgKyAnIG9mIHR5cGUgJyArIHR5cGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciBpZCA9IHBheWxvYWQuY29ubmVjdGlvbklkO1xuICAgICAgY29ubmVjdGlvbiA9IHRoaXMuZ2V0Q29ubmVjdGlvbihwZWVyLCBpZCk7XG5cbiAgICAgIGlmIChjb25uZWN0aW9uICYmIGNvbm5lY3Rpb24ucGMpIHtcbiAgICAgICAgLy8gUGFzcyBpdCBvbi5cbiAgICAgICAgY29ubmVjdGlvbi5oYW5kbGVNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgfSBlbHNlIGlmIChpZCkge1xuICAgICAgICAvLyBTdG9yZSBmb3IgcG9zc2libGUgbGF0ZXIgdXNlXG4gICAgICAgIHRoaXMuX3N0b3JlTWVzc2FnZShpZCwgbWVzc2FnZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB1dGlsLndhcm4oJ1lvdSByZWNlaXZlZCBhbiB1bnJlY29nbml6ZWQgbWVzc2FnZTonLCBtZXNzYWdlKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICB9XG59O1xuXG4vKiogU3RvcmVzIG1lc3NhZ2VzIHdpdGhvdXQgYSBzZXQgdXAgY29ubmVjdGlvbiwgdG8gYmUgY2xhaW1lZCBsYXRlci4gKi9cblBlZXIucHJvdG90eXBlLl9zdG9yZU1lc3NhZ2UgPSBmdW5jdGlvbihjb25uZWN0aW9uSWQsIG1lc3NhZ2UpIHtcbiAgaWYgKCF0aGlzLl9sb3N0TWVzc2FnZXNbY29ubmVjdGlvbklkXSkge1xuICAgIHRoaXMuX2xvc3RNZXNzYWdlc1tjb25uZWN0aW9uSWRdID0gW107XG4gIH1cbiAgdGhpcy5fbG9zdE1lc3NhZ2VzW2Nvbm5lY3Rpb25JZF0ucHVzaChtZXNzYWdlKTtcbn07XG5cbi8qKiBSZXRyaWV2ZSBtZXNzYWdlcyBmcm9tIGxvc3QgbWVzc2FnZSBzdG9yZSAqL1xuUGVlci5wcm90b3R5cGUuX2dldE1lc3NhZ2VzID0gZnVuY3Rpb24oY29ubmVjdGlvbklkKSB7XG4gIHZhciBtZXNzYWdlcyA9IHRoaXMuX2xvc3RNZXNzYWdlc1tjb25uZWN0aW9uSWRdO1xuICBpZiAobWVzc2FnZXMpIHtcbiAgICBkZWxldGUgdGhpcy5fbG9zdE1lc3NhZ2VzW2Nvbm5lY3Rpb25JZF07XG4gICAgcmV0dXJuIG1lc3NhZ2VzO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBbXTtcbiAgfVxufTtcblxuLyoqXG4gKiBSZXR1cm5zIGEgRGF0YUNvbm5lY3Rpb24gdG8gdGhlIHNwZWNpZmllZCBwZWVyLiBTZWUgZG9jdW1lbnRhdGlvbiBmb3IgYVxuICogY29tcGxldGUgbGlzdCBvZiBvcHRpb25zLlxuICovXG5QZWVyLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24ocGVlciwgb3B0aW9ucykge1xuICBpZiAodGhpcy5kaXNjb25uZWN0ZWQpIHtcbiAgICB1dGlsLndhcm4oJ1lvdSBjYW5ub3QgY29ubmVjdCB0byBhIG5ldyBQZWVyIGJlY2F1c2UgeW91IGNhbGxlZCAnICtcbiAgICAgICcuZGlzY29ubmVjdCgpIG9uIHRoaXMgUGVlciBhbmQgZW5kZWQgeW91ciBjb25uZWN0aW9uIHdpdGggdGhlICcgK1xuICAgICAgJ3NlcnZlci4gWW91IGNhbiBjcmVhdGUgYSBuZXcgUGVlciB0byByZWNvbm5lY3QsIG9yIGNhbGwgcmVjb25uZWN0ICcgK1xuICAgICAgJ29uIHRoaXMgcGVlciBpZiB5b3UgYmVsaWV2ZSBpdHMgSUQgdG8gc3RpbGwgYmUgYXZhaWxhYmxlLicpO1xuICAgIHRoaXMuZW1pdEVycm9yKCdkaXNjb25uZWN0ZWQnLCAnQ2Fubm90IGNvbm5lY3QgdG8gbmV3IFBlZXIgYWZ0ZXIgZGlzY29ubmVjdGluZyBmcm9tIHNlcnZlci4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGNvbm5lY3Rpb24gPSBuZXcgRGF0YUNvbm5lY3Rpb24ocGVlciwgdGhpcywgb3B0aW9ucyk7XG4gIHRoaXMuX2FkZENvbm5lY3Rpb24ocGVlciwgY29ubmVjdGlvbik7XG4gIHJldHVybiBjb25uZWN0aW9uO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGEgTWVkaWFDb25uZWN0aW9uIHRvIHRoZSBzcGVjaWZpZWQgcGVlci4gU2VlIGRvY3VtZW50YXRpb24gZm9yIGFcbiAqIGNvbXBsZXRlIGxpc3Qgb2Ygb3B0aW9ucy5cbiAqL1xuUGVlci5wcm90b3R5cGUuY2FsbCA9IGZ1bmN0aW9uKHBlZXIsIHN0cmVhbSwgb3B0aW9ucykge1xuICBpZiAodGhpcy5kaXNjb25uZWN0ZWQpIHtcbiAgICB1dGlsLndhcm4oJ1lvdSBjYW5ub3QgY29ubmVjdCB0byBhIG5ldyBQZWVyIGJlY2F1c2UgeW91IGNhbGxlZCAnICtcbiAgICAgICcuZGlzY29ubmVjdCgpIG9uIHRoaXMgUGVlciBhbmQgZW5kZWQgeW91ciBjb25uZWN0aW9uIHdpdGggdGhlICcgK1xuICAgICAgJ3NlcnZlci4gWW91IGNhbiBjcmVhdGUgYSBuZXcgUGVlciB0byByZWNvbm5lY3QuJyk7XG4gICAgdGhpcy5lbWl0RXJyb3IoJ2Rpc2Nvbm5lY3RlZCcsICdDYW5ub3QgY29ubmVjdCB0byBuZXcgUGVlciBhZnRlciBkaXNjb25uZWN0aW5nIGZyb20gc2VydmVyLicpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXN0cmVhbSkge1xuICAgIHV0aWwuZXJyb3IoJ1RvIGNhbGwgYSBwZWVyLCB5b3UgbXVzdCBwcm92aWRlIGEgc3RyZWFtIGZyb20geW91ciBicm93c2VyXFwncyBgZ2V0VXNlck1lZGlhYC4nKTtcbiAgICByZXR1cm47XG4gIH1cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIG9wdGlvbnMuX3N0cmVhbSA9IHN0cmVhbTtcbiAgdmFyIGNhbGwgPSBuZXcgTWVkaWFDb25uZWN0aW9uKHBlZXIsIHRoaXMsIG9wdGlvbnMpO1xuICB0aGlzLl9hZGRDb25uZWN0aW9uKHBlZXIsIGNhbGwpO1xuICByZXR1cm4gY2FsbDtcbn07XG5cbi8qKiBBZGQgYSBkYXRhL21lZGlhIGNvbm5lY3Rpb24gdG8gdGhpcyBwZWVyLiAqL1xuUGVlci5wcm90b3R5cGUuX2FkZENvbm5lY3Rpb24gPSBmdW5jdGlvbihwZWVyLCBjb25uZWN0aW9uKSB7XG4gIGlmICghdGhpcy5jb25uZWN0aW9uc1twZWVyXSkge1xuICAgIHRoaXMuY29ubmVjdGlvbnNbcGVlcl0gPSBbXTtcbiAgfVxuICB0aGlzLmNvbm5lY3Rpb25zW3BlZXJdLnB1c2goY29ubmVjdGlvbik7XG59O1xuXG4vKiogUmV0cmlldmUgYSBkYXRhL21lZGlhIGNvbm5lY3Rpb24gZm9yIHRoaXMgcGVlci4gKi9cblBlZXIucHJvdG90eXBlLmdldENvbm5lY3Rpb24gPSBmdW5jdGlvbihwZWVyLCBpZCkge1xuICB2YXIgY29ubmVjdGlvbnMgPSB0aGlzLmNvbm5lY3Rpb25zW3BlZXJdO1xuICBpZiAoIWNvbm5lY3Rpb25zKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgZm9yICh2YXIgaSA9IDAsIGlpID0gY29ubmVjdGlvbnMubGVuZ3RoOyBpIDwgaWk7IGkrKykge1xuICAgIGlmIChjb25uZWN0aW9uc1tpXS5pZCA9PT0gaWQpIHtcbiAgICAgIHJldHVybiBjb25uZWN0aW9uc1tpXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5QZWVyLnByb3RvdHlwZS5fZGVsYXllZEFib3J0ID0gZnVuY3Rpb24odHlwZSwgbWVzc2FnZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHV0aWwuc2V0WmVyb1RpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICBzZWxmLl9hYm9ydCh0eXBlLCBtZXNzYWdlKTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIERlc3Ryb3lzIHRoZSBQZWVyIGFuZCBlbWl0cyBhbiBlcnJvciBtZXNzYWdlLlxuICogVGhlIFBlZXIgaXMgbm90IGRlc3Ryb3llZCBpZiBpdCdzIGluIGEgZGlzY29ubmVjdGVkIHN0YXRlLCBpbiB3aGljaCBjYXNlXG4gKiBpdCByZXRhaW5zIGl0cyBkaXNjb25uZWN0ZWQgc3RhdGUgYW5kIGl0cyBleGlzdGluZyBjb25uZWN0aW9ucy5cbiAqL1xuUGVlci5wcm90b3R5cGUuX2Fib3J0ID0gZnVuY3Rpb24odHlwZSwgbWVzc2FnZSkge1xuICB1dGlsLmVycm9yKCdBYm9ydGluZyEnKTtcbiAgaWYgKCF0aGlzLl9sYXN0U2VydmVySWQpIHtcbiAgICB0aGlzLmRlc3Ryb3koKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgfVxuICB0aGlzLmVtaXRFcnJvcih0eXBlLCBtZXNzYWdlKTtcbn07XG5cbi8qKiBFbWl0cyBhIHR5cGVkIGVycm9yIG1lc3NhZ2UuICovXG5QZWVyLnByb3RvdHlwZS5lbWl0RXJyb3IgPSBmdW5jdGlvbih0eXBlLCBlcnIpIHtcbiAgdXRpbC5lcnJvcignRXJyb3I6JywgZXJyKTtcbiAgaWYgKHR5cGVvZiBlcnIgPT09ICdzdHJpbmcnKSB7XG4gICAgZXJyID0gbmV3IEVycm9yKGVycik7XG4gIH1cbiAgZXJyLnR5cGUgPSB0eXBlO1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcbn07XG5cbi8qKlxuICogRGVzdHJveXMgdGhlIFBlZXI6IGNsb3NlcyBhbGwgYWN0aXZlIGNvbm5lY3Rpb25zIGFzIHdlbGwgYXMgdGhlIGNvbm5lY3Rpb25cbiAqICB0byB0aGUgc2VydmVyLlxuICogV2FybmluZzogVGhlIHBlZXIgY2FuIG5vIGxvbmdlciBjcmVhdGUgb3IgYWNjZXB0IGNvbm5lY3Rpb25zIGFmdGVyIGJlaW5nXG4gKiAgZGVzdHJveWVkLlxuICovXG5QZWVyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5kZXN0cm95ZWQpIHtcbiAgICB0aGlzLl9jbGVhbnVwKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0KCk7XG4gICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlO1xuICB9XG59O1xuXG5cbi8qKiBEaXNjb25uZWN0cyBldmVyeSBjb25uZWN0aW9uIG9uIHRoaXMgcGVlci4gKi9cblBlZXIucHJvdG90eXBlLl9jbGVhbnVwID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmNvbm5lY3Rpb25zKSB7XG4gICAgdmFyIHBlZXJzID0gT2JqZWN0LmtleXModGhpcy5jb25uZWN0aW9ucyk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGlpID0gcGVlcnMubGVuZ3RoOyBpIDwgaWk7IGkrKykge1xuICAgICAgdGhpcy5fY2xlYW51cFBlZXIocGVlcnNbaV0pO1xuICAgIH1cbiAgfVxuICB0aGlzLmVtaXQoJ2Nsb3NlJyk7XG59O1xuXG4vKiogQ2xvc2VzIGFsbCBjb25uZWN0aW9ucyB0byB0aGlzIHBlZXIuICovXG5QZWVyLnByb3RvdHlwZS5fY2xlYW51cFBlZXIgPSBmdW5jdGlvbihwZWVyKSB7XG4gIHZhciBjb25uZWN0aW9ucyA9IHRoaXMuY29ubmVjdGlvbnNbcGVlcl07XG4gIGZvciAodmFyIGogPSAwLCBqaiA9IGNvbm5lY3Rpb25zLmxlbmd0aDsgaiA8IGpqOyBqICs9IDEpIHtcbiAgICBjb25uZWN0aW9uc1tqXS5jbG9zZSgpO1xuICB9XG59O1xuXG4vKipcbiAqIERpc2Nvbm5lY3RzIHRoZSBQZWVyJ3MgY29ubmVjdGlvbiB0byB0aGUgUGVlclNlcnZlci4gRG9lcyBub3QgY2xvc2UgYW55XG4gKiAgYWN0aXZlIGNvbm5lY3Rpb25zLlxuICogV2FybmluZzogVGhlIHBlZXIgY2FuIG5vIGxvbmdlciBjcmVhdGUgb3IgYWNjZXB0IGNvbm5lY3Rpb25zIGFmdGVyIGJlaW5nXG4gKiAgZGlzY29ubmVjdGVkLiBJdCBhbHNvIGNhbm5vdCByZWNvbm5lY3QgdG8gdGhlIHNlcnZlci5cbiAqL1xuUGVlci5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHV0aWwuc2V0WmVyb1RpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICBpZiAoIXNlbGYuZGlzY29ubmVjdGVkKSB7XG4gICAgICBzZWxmLmRpc2Nvbm5lY3RlZCA9IHRydWU7XG4gICAgICBzZWxmLm9wZW4gPSBmYWxzZTtcbiAgICAgIGlmIChzZWxmLnNvY2tldCkge1xuICAgICAgICBzZWxmLnNvY2tldC5jbG9zZSgpO1xuICAgICAgfVxuICAgICAgc2VsZi5lbWl0KCdkaXNjb25uZWN0ZWQnLCBzZWxmLmlkKTtcbiAgICAgIHNlbGYuX2xhc3RTZXJ2ZXJJZCA9IHNlbGYuaWQ7XG4gICAgICBzZWxmLmlkID0gbnVsbDtcbiAgICB9XG4gIH0pO1xufTtcblxuLyoqIEF0dGVtcHRzIHRvIHJlY29ubmVjdCB3aXRoIHRoZSBzYW1lIElELiAqL1xuUGVlci5wcm90b3R5cGUucmVjb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmRpc2Nvbm5lY3RlZCAmJiAhdGhpcy5kZXN0cm95ZWQpIHtcbiAgICB1dGlsLmxvZygnQXR0ZW1wdGluZyByZWNvbm5lY3Rpb24gdG8gc2VydmVyIHdpdGggSUQgJyArIHRoaXMuX2xhc3RTZXJ2ZXJJZCk7XG4gICAgdGhpcy5kaXNjb25uZWN0ZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9pbml0aWFsaXplU2VydmVyQ29ubmVjdGlvbigpO1xuICAgIHRoaXMuX2luaXRpYWxpemUodGhpcy5fbGFzdFNlcnZlcklkKTtcbiAgfSBlbHNlIGlmICh0aGlzLmRlc3Ryb3llZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignVGhpcyBwZWVyIGNhbm5vdCByZWNvbm5lY3QgdG8gdGhlIHNlcnZlci4gSXQgaGFzIGFscmVhZHkgYmVlbiBkZXN0cm95ZWQuJyk7XG4gIH0gZWxzZSBpZiAoIXRoaXMuZGlzY29ubmVjdGVkICYmICF0aGlzLm9wZW4pIHtcbiAgICAvLyBEbyBub3RoaW5nLiBXZSdyZSBzdGlsbCBjb25uZWN0aW5nIHRoZSBmaXJzdCB0aW1lLlxuICAgIHV0aWwuZXJyb3IoJ0luIGEgaHVycnk/IFdlXFwncmUgc3RpbGwgdHJ5aW5nIHRvIG1ha2UgdGhlIGluaXRpYWwgY29ubmVjdGlvbiEnKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BlZXIgJyArIHRoaXMuaWQgKyAnIGNhbm5vdCByZWNvbm5lY3QgYmVjYXVzZSBpdCBpcyBub3QgZGlzY29ubmVjdGVkIGZyb20gdGhlIHNlcnZlciEnKTtcbiAgfVxufTtcblxuLyoqXG4gKiBHZXQgYSBsaXN0IG9mIGF2YWlsYWJsZSBwZWVyIElEcy4gSWYgeW91J3JlIHJ1bm5pbmcgeW91ciBvd24gc2VydmVyLCB5b3UnbGxcbiAqIHdhbnQgdG8gc2V0IGFsbG93X2Rpc2NvdmVyeTogdHJ1ZSBpbiB0aGUgUGVlclNlcnZlciBvcHRpb25zLiBJZiB5b3UncmUgdXNpbmdcbiAqIHRoZSBjbG91ZCBzZXJ2ZXIsIGVtYWlsIHRlYW1AcGVlcmpzLmNvbSB0byBnZXQgdGhlIGZ1bmN0aW9uYWxpdHkgZW5hYmxlZCBmb3JcbiAqIHlvdXIga2V5LlxuICovXG5QZWVyLnByb3RvdHlwZS5saXN0QWxsUGVlcnMgPSBmdW5jdGlvbihjYikge1xuICBjYiA9IGNiIHx8IGZ1bmN0aW9uKCkge307XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgdmFyIHByb3RvY29sID0gdGhpcy5vcHRpb25zLnNlY3VyZSA/ICdodHRwczovLycgOiAnaHR0cDovLyc7XG4gIHZhciB1cmwgPSBwcm90b2NvbCArIHRoaXMub3B0aW9ucy5ob3N0ICsgJzonICsgdGhpcy5vcHRpb25zLnBvcnQgK1xuICAgIHRoaXMub3B0aW9ucy5wYXRoICsgdGhpcy5vcHRpb25zLmtleSArICcvcGVlcnMnO1xuICB2YXIgcXVlcnlTdHJpbmcgPSAnP3RzPScgKyBuZXcgRGF0ZSgpLmdldFRpbWUoKSArICcnICsgTWF0aC5yYW5kb20oKTtcbiAgdXJsICs9IHF1ZXJ5U3RyaW5nO1xuXG4gIC8vIElmIHRoZXJlJ3Mgbm8gSUQgd2UgbmVlZCB0byB3YWl0IGZvciBvbmUgYmVmb3JlIHRyeWluZyB0byBpbml0IHNvY2tldC5cbiAgaHR0cC5vcGVuKCdnZXQnLCB1cmwsIHRydWUpO1xuICBodHRwLm9uZXJyb3IgPSBmdW5jdGlvbihlKSB7XG4gICAgc2VsZi5fYWJvcnQoJ3NlcnZlci1lcnJvcicsICdDb3VsZCBub3QgZ2V0IHBlZXJzIGZyb20gdGhlIHNlcnZlci4nKTtcbiAgICBjYihbXSk7XG4gIH07XG4gIGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKGh0dHAucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoaHR0cC5zdGF0dXMgPT09IDQwMSkge1xuICAgICAgdmFyIGhlbHBmdWxFcnJvciA9ICcnO1xuICAgICAgaWYgKHNlbGYub3B0aW9ucy5ob3N0ICE9PSB1dGlsLkNMT1VEX0hPU1QpIHtcbiAgICAgICAgaGVscGZ1bEVycm9yID0gJ0l0IGxvb2tzIGxpa2UgeW91XFwncmUgdXNpbmcgdGhlIGNsb3VkIHNlcnZlci4gWW91IGNhbiBlbWFpbCAnICtcbiAgICAgICAgICAndGVhbUBwZWVyanMuY29tIHRvIGVuYWJsZSBwZWVyIGxpc3RpbmcgZm9yIHlvdXIgQVBJIGtleS4nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGVscGZ1bEVycm9yID0gJ1lvdSBuZWVkIHRvIGVuYWJsZSBgYWxsb3dfZGlzY292ZXJ5YCBvbiB5b3VyIHNlbGYtaG9zdGVkICcgK1xuICAgICAgICAgICdQZWVyU2VydmVyIHRvIHVzZSB0aGlzIGZlYXR1cmUuJztcbiAgICAgIH1cbiAgICAgIGNiKFtdKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSXQgZG9lc25cXCd0IGxvb2sgbGlrZSB5b3UgaGF2ZSBwZXJtaXNzaW9uIHRvIGxpc3QgcGVlcnMgSURzLiAnICsgaGVscGZ1bEVycm9yKTtcbiAgICB9IGVsc2UgaWYgKGh0dHAuc3RhdHVzICE9PSAyMDApIHtcbiAgICAgIGNiKFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2IoSlNPTi5wYXJzZShodHRwLnJlc3BvbnNlVGV4dCkpO1xuICAgIH1cbiAgfTtcbiAgaHR0cC5zZW5kKG51bGwpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQZWVyO1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWwnKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIzJyk7XG5cbi8qKlxuICogQW4gYWJzdHJhY3Rpb24gb24gdG9wIG9mIFdlYlNvY2tldHMgYW5kIFhIUiBzdHJlYW1pbmcgdG8gcHJvdmlkZSBmYXN0ZXN0XG4gKiBwb3NzaWJsZSBjb25uZWN0aW9uIGZvciBwZWVycy5cbiAqL1xuZnVuY3Rpb24gU29ja2V0KHNlY3VyZSwgaG9zdCwgcG9ydCwgcGF0aCwga2V5KSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTb2NrZXQpKSByZXR1cm4gbmV3IFNvY2tldChzZWN1cmUsIGhvc3QsIHBvcnQsIHBhdGgsIGtleSk7XG5cbiAgRXZlbnRFbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgLy8gRGlzY29ubmVjdGVkIG1hbnVhbGx5LlxuICB0aGlzLmRpc2Nvbm5lY3RlZCA9IGZhbHNlO1xuICB0aGlzLl9xdWV1ZSA9IFtdO1xuXG4gIHZhciBodHRwUHJvdG9jb2wgPSBzZWN1cmUgPyAnaHR0cHM6Ly8nIDogJ2h0dHA6Ly8nO1xuICB2YXIgd3NQcm90b2NvbCA9IHNlY3VyZSA/ICd3c3M6Ly8nIDogJ3dzOi8vJztcbiAgdGhpcy5faHR0cFVybCA9IGh0dHBQcm90b2NvbCArIGhvc3QgKyAnOicgKyBwb3J0ICsgcGF0aCArIGtleTtcbiAgdGhpcy5fd3NVcmwgPSB3c1Byb3RvY29sICsgaG9zdCArICc6JyArIHBvcnQgKyBwYXRoICsgJ3BlZXJqcz9rZXk9JyArIGtleTtcbn1cblxudXRpbC5pbmhlcml0cyhTb2NrZXQsIEV2ZW50RW1pdHRlcik7XG5cblxuLyoqIENoZWNrIGluIHdpdGggSUQgb3IgZ2V0IG9uZSBmcm9tIHNlcnZlci4gKi9cblNvY2tldC5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbihpZCwgdG9rZW4pIHtcbiAgdGhpcy5pZCA9IGlkO1xuXG4gIHRoaXMuX2h0dHBVcmwgKz0gJy8nICsgaWQgKyAnLycgKyB0b2tlbjtcbiAgdGhpcy5fd3NVcmwgKz0gJyZpZD0nICsgaWQgKyAnJnRva2VuPScgKyB0b2tlbjtcblxuICB0aGlzLl9zdGFydFhoclN0cmVhbSgpO1xuICB0aGlzLl9zdGFydFdlYlNvY2tldCgpO1xufVxuXG5cbi8qKiBTdGFydCB1cCB3ZWJzb2NrZXQgY29tbXVuaWNhdGlvbnMuICovXG5Tb2NrZXQucHJvdG90eXBlLl9zdGFydFdlYlNvY2tldCA9IGZ1bmN0aW9uKGlkKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAodGhpcy5fc29ja2V0KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5fc29ja2V0ID0gbmV3IFdlYlNvY2tldCh0aGlzLl93c1VybCk7XG5cbiAgdGhpcy5fc29ja2V0Lm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgIHV0aWwubG9nKCdJbnZhbGlkIHNlcnZlciBtZXNzYWdlJywgZXZlbnQuZGF0YSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNlbGYuZW1pdCgnbWVzc2FnZScsIGRhdGEpO1xuICB9O1xuXG4gIHRoaXMuX3NvY2tldC5vbmNsb3NlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICB1dGlsLmxvZygnU29ja2V0IGNsb3NlZC4nKTtcbiAgICBzZWxmLmRpc2Nvbm5lY3RlZCA9IHRydWU7XG4gICAgc2VsZi5lbWl0KCdkaXNjb25uZWN0ZWQnKTtcbiAgfTtcblxuICAvLyBUYWtlIGNhcmUgb2YgdGhlIHF1ZXVlIG9mIGNvbm5lY3Rpb25zIGlmIG5lY2Vzc2FyeSBhbmQgbWFrZSBzdXJlIFBlZXIga25vd3NcbiAgLy8gc29ja2V0IGlzIG9wZW4uXG4gIHRoaXMuX3NvY2tldC5vbm9wZW4gPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoc2VsZi5fdGltZW91dCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHNlbGYuX3RpbWVvdXQpO1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICBzZWxmLl9odHRwLmFib3J0KCk7XG4gICAgICAgIHNlbGYuX2h0dHAgPSBudWxsO1xuICAgICAgfSwgNTAwMCk7XG4gICAgfVxuICAgIHNlbGYuX3NlbmRRdWV1ZWRNZXNzYWdlcygpO1xuICAgIHV0aWwubG9nKCdTb2NrZXQgb3BlbicpO1xuICB9O1xufVxuXG4vKiogU3RhcnQgWEhSIHN0cmVhbWluZy4gKi9cblNvY2tldC5wcm90b3R5cGUuX3N0YXJ0WGhyU3RyZWFtID0gZnVuY3Rpb24obikge1xuICB0cnkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB0aGlzLl9odHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgdGhpcy5faHR0cC5faW5kZXggPSAxO1xuICAgIHRoaXMuX2h0dHAuX3N0cmVhbUluZGV4ID0gbiB8fCAwO1xuICAgIHRoaXMuX2h0dHAub3BlbigncG9zdCcsIHRoaXMuX2h0dHBVcmwgKyAnL2lkP2k9JyArIHRoaXMuX2h0dHAuX3N0cmVhbUluZGV4LCB0cnVlKTtcbiAgICB0aGlzLl9odHRwLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgIC8vIElmIHdlIGdldCBhbiBlcnJvciwgbGlrZWx5IHNvbWV0aGluZyB3ZW50IHdyb25nLlxuICAgICAgLy8gU3RvcCBzdHJlYW1pbmcuXG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fdGltZW91dCk7XG4gICAgICBzZWxmLmVtaXQoJ2Rpc2Nvbm5lY3RlZCcpO1xuICAgIH1cbiAgICB0aGlzLl9odHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PSAyICYmIHRoaXMub2xkKSB7XG4gICAgICAgIHRoaXMub2xkLmFib3J0KCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm9sZDtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5yZWFkeVN0YXRlID4gMiAmJiB0aGlzLnN0YXR1cyA9PT0gMjAwICYmIHRoaXMucmVzcG9uc2VUZXh0KSB7XG4gICAgICAgIHNlbGYuX2hhbmRsZVN0cmVhbSh0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHRoaXMuX2h0dHAuc2VuZChudWxsKTtcbiAgICB0aGlzLl9zZXRIVFRQVGltZW91dCgpO1xuICB9IGNhdGNoKGUpIHtcbiAgICB1dGlsLmxvZygnWE1MSHR0cFJlcXVlc3Qgbm90IGF2YWlsYWJsZTsgZGVmYXVsdGluZyB0byBXZWJTb2NrZXRzJyk7XG4gIH1cbn1cblxuXG4vKiogSGFuZGxlcyBvbnJlYWR5c3RhdGVjaGFuZ2UgcmVzcG9uc2UgYXMgYSBzdHJlYW0uICovXG5Tb2NrZXQucHJvdG90eXBlLl9oYW5kbGVTdHJlYW0gPSBmdW5jdGlvbihodHRwKSB7XG4gIC8vIDMgYW5kIDQgYXJlIGxvYWRpbmcvZG9uZSBzdGF0ZS4gQWxsIG90aGVycyBhcmUgbm90IHJlbGV2YW50LlxuICB2YXIgbWVzc2FnZXMgPSBodHRwLnJlc3BvbnNlVGV4dC5zcGxpdCgnXFxuJyk7XG5cbiAgLy8gQ2hlY2sgdG8gc2VlIGlmIGFueXRoaW5nIG5lZWRzIHRvIGJlIHByb2Nlc3NlZCBvbiBidWZmZXIuXG4gIGlmIChodHRwLl9idWZmZXIpIHtcbiAgICB3aGlsZSAoaHR0cC5fYnVmZmVyLmxlbmd0aCA+IDApIHtcbiAgICAgIHZhciBpbmRleCA9IGh0dHAuX2J1ZmZlci5zaGlmdCgpO1xuICAgICAgdmFyIGJ1ZmZlcmVkTWVzc2FnZSA9IG1lc3NhZ2VzW2luZGV4XTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGJ1ZmZlcmVkTWVzc2FnZSA9IEpTT04ucGFyc2UoYnVmZmVyZWRNZXNzYWdlKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBodHRwLl9idWZmZXIuc2hpZnQoaW5kZXgpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIGJ1ZmZlcmVkTWVzc2FnZSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIG1lc3NhZ2UgPSBtZXNzYWdlc1todHRwLl9pbmRleF07XG4gIGlmIChtZXNzYWdlKSB7XG4gICAgaHR0cC5faW5kZXggKz0gMTtcbiAgICAvLyBCdWZmZXJpbmctLXRoaXMgbWVzc2FnZSBpcyBpbmNvbXBsZXRlIGFuZCB3ZSdsbCBnZXQgdG8gaXQgbmV4dCB0aW1lLlxuICAgIC8vIFRoaXMgY2hlY2tzIGlmIHRoZSBodHRwUmVzcG9uc2UgZW5kZWQgaW4gYSBgXFxuYCwgaW4gd2hpY2ggY2FzZSB0aGUgbGFzdFxuICAgIC8vIGVsZW1lbnQgb2YgbWVzc2FnZXMgc2hvdWxkIGJlIHRoZSBlbXB0eSBzdHJpbmcuXG4gICAgaWYgKGh0dHAuX2luZGV4ID09PSBtZXNzYWdlcy5sZW5ndGgpIHtcbiAgICAgIGlmICghaHR0cC5fYnVmZmVyKSB7XG4gICAgICAgIGh0dHAuX2J1ZmZlciA9IFtdO1xuICAgICAgfVxuICAgICAgaHR0cC5fYnVmZmVyLnB1c2goaHR0cC5faW5kZXggLSAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbWVzc2FnZSA9IEpTT04ucGFyc2UobWVzc2FnZSk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgdXRpbC5sb2coJ0ludmFsaWQgc2VydmVyIG1lc3NhZ2UnLCBtZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgbWVzc2FnZSk7XG4gICAgfVxuICB9XG59XG5cblNvY2tldC5wcm90b3R5cGUuX3NldEhUVFBUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5fdGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9sZCA9IHNlbGYuX2h0dHA7XG4gICAgaWYgKCFzZWxmLl93c09wZW4oKSkge1xuICAgICAgc2VsZi5fc3RhcnRYaHJTdHJlYW0ob2xkLl9zdHJlYW1JbmRleCArIDEpO1xuICAgICAgc2VsZi5faHR0cC5vbGQgPSBvbGQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9sZC5hYm9ydCgpO1xuICAgIH1cbiAgfSwgMjUwMDApO1xufVxuXG4vKiogSXMgdGhlIHdlYnNvY2tldCBjdXJyZW50bHkgb3Blbj8gKi9cblNvY2tldC5wcm90b3R5cGUuX3dzT3BlbiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5fc29ja2V0ICYmIHRoaXMuX3NvY2tldC5yZWFkeVN0YXRlID09IDE7XG59XG5cbi8qKiBTZW5kIHF1ZXVlZCBtZXNzYWdlcy4gKi9cblNvY2tldC5wcm90b3R5cGUuX3NlbmRRdWV1ZWRNZXNzYWdlcyA9IGZ1bmN0aW9uKCkge1xuICBmb3IgKHZhciBpID0gMCwgaWkgPSB0aGlzLl9xdWV1ZS5sZW5ndGg7IGkgPCBpaTsgaSArPSAxKSB7XG4gICAgdGhpcy5zZW5kKHRoaXMuX3F1ZXVlW2ldKTtcbiAgfVxufVxuXG4vKiogRXhwb3NlZCBzZW5kIGZvciBEQyAmIFBlZXIuICovXG5Tb2NrZXQucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihkYXRhKSB7XG4gIGlmICh0aGlzLmRpc2Nvbm5lY3RlZCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIElmIHdlIGRpZG4ndCBnZXQgYW4gSUQgeWV0LCB3ZSBjYW4ndCB5ZXQgc2VuZCBhbnl0aGluZyBzbyB3ZSBzaG91bGQgcXVldWVcbiAgLy8gdXAgdGhlc2UgbWVzc2FnZXMuXG4gIGlmICghdGhpcy5pZCkge1xuICAgIHRoaXMuX3F1ZXVlLnB1c2goZGF0YSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCFkYXRhLnR5cGUpIHtcbiAgICB0aGlzLmVtaXQoJ2Vycm9yJywgJ0ludmFsaWQgbWVzc2FnZScpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBtZXNzYWdlID0gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gIGlmICh0aGlzLl93c09wZW4oKSkge1xuICAgIHRoaXMuX3NvY2tldC5zZW5kKG1lc3NhZ2UpO1xuICB9IGVsc2Uge1xuICAgIHZhciBodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgdmFyIHVybCA9IHRoaXMuX2h0dHBVcmwgKyAnLycgKyBkYXRhLnR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICBodHRwLm9wZW4oJ3Bvc3QnLCB1cmwsIHRydWUpO1xuICAgIGh0dHAuc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICBodHRwLnNlbmQobWVzc2FnZSk7XG4gIH1cbn1cblxuU29ja2V0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuZGlzY29ubmVjdGVkICYmIHRoaXMuX3dzT3BlbigpKSB7XG4gICAgdGhpcy5fc29ja2V0LmNsb3NlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0ZWQgPSB0cnVlO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU29ja2V0O1xuIiwidmFyIGRlZmF1bHRDb25maWcgPSB7J2ljZVNlcnZlcnMnOiBbeyAndXJsJzogJ3N0dW46c3R1bi5sLmdvb2dsZS5jb206MTkzMDInIH1dfTtcbnZhciBkYXRhQ291bnQgPSAxO1xuXG52YXIgQmluYXJ5UGFjayA9IHJlcXVpcmUoJ2pzLWJpbmFyeXBhY2snKTtcbnZhciBSVENQZWVyQ29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vYWRhcHRlcicpLlJUQ1BlZXJDb25uZWN0aW9uO1xuXG52YXIgdXRpbCA9IHtcbiAgbm9vcDogZnVuY3Rpb24oKSB7fSxcblxuICBDTE9VRF9IT1NUOiAnMC5wZWVyanMuY29tJyxcbiAgQ0xPVURfUE9SVDogOTAwMCxcblxuICAvLyBCcm93c2VycyB0aGF0IG5lZWQgY2h1bmtpbmc6XG4gIGNodW5rZWRCcm93c2VyczogeydDaHJvbWUnOiAxfSxcbiAgY2h1bmtlZE1UVTogMTYzMDAsIC8vIFRoZSBvcmlnaW5hbCA2MDAwMCBieXRlcyBzZXR0aW5nIGRvZXMgbm90IHdvcmsgd2hlbiBzZW5kaW5nIGRhdGEgZnJvbSBGaXJlZm94IHRvIENocm9tZSwgd2hpY2ggaXMgXCJjdXQgb2ZmXCIgYWZ0ZXIgMTYzODQgYnl0ZXMgYW5kIGRlbGl2ZXJlZCBpbmRpdmlkdWFsbHkuXG5cbiAgLy8gTG9nZ2luZyBsb2dpY1xuICBsb2dMZXZlbDogMCxcbiAgc2V0TG9nTGV2ZWw6IGZ1bmN0aW9uKGxldmVsKSB7XG4gICAgdmFyIGRlYnVnTGV2ZWwgPSBwYXJzZUludChsZXZlbCwgMTApO1xuICAgIGlmICghaXNOYU4ocGFyc2VJbnQobGV2ZWwsIDEwKSkpIHtcbiAgICAgIHV0aWwubG9nTGV2ZWwgPSBkZWJ1Z0xldmVsO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJZiB0aGV5IGFyZSB1c2luZyB0cnV0aHkvZmFsc3kgdmFsdWVzIGZvciBkZWJ1Z1xuICAgICAgdXRpbC5sb2dMZXZlbCA9IGxldmVsID8gMyA6IDA7XG4gICAgfVxuICAgIHV0aWwubG9nID0gdXRpbC53YXJuID0gdXRpbC5lcnJvciA9IHV0aWwubm9vcDtcbiAgICBpZiAodXRpbC5sb2dMZXZlbCA+IDApIHtcbiAgICAgIHV0aWwuZXJyb3IgPSB1dGlsLl9wcmludFdpdGgoJ0VSUk9SJyk7XG4gICAgfVxuICAgIGlmICh1dGlsLmxvZ0xldmVsID4gMSkge1xuICAgICAgdXRpbC53YXJuID0gdXRpbC5fcHJpbnRXaXRoKCdXQVJOSU5HJyk7XG4gICAgfVxuICAgIGlmICh1dGlsLmxvZ0xldmVsID4gMikge1xuICAgICAgdXRpbC5sb2cgPSB1dGlsLl9wcmludDtcbiAgICB9XG4gIH0sXG4gIHNldExvZ0Z1bmN0aW9uOiBmdW5jdGlvbihmbikge1xuICAgIGlmIChmbi5jb25zdHJ1Y3RvciAhPT0gRnVuY3Rpb24pIHtcbiAgICAgIHV0aWwud2FybignVGhlIGxvZyBmdW5jdGlvbiB5b3UgcGFzc2VkIGluIGlzIG5vdCBhIGZ1bmN0aW9uLiBEZWZhdWx0aW5nIHRvIHJlZ3VsYXIgbG9ncy4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXRpbC5fcHJpbnQgPSBmbjtcbiAgICB9XG4gIH0sXG5cbiAgX3ByaW50V2l0aDogZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGNvcHkgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgY29weS51bnNoaWZ0KHByZWZpeCk7XG4gICAgICB1dGlsLl9wcmludC5hcHBseSh1dGlsLCBjb3B5KTtcbiAgICB9O1xuICB9LFxuICBfcHJpbnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZXJyID0gZmFsc2U7XG4gICAgdmFyIGNvcHkgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIGNvcHkudW5zaGlmdCgnUGVlckpTOiAnKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNvcHkubGVuZ3RoOyBpIDwgbDsgaSsrKXtcbiAgICAgIGlmIChjb3B5W2ldIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgY29weVtpXSA9ICcoJyArIGNvcHlbaV0ubmFtZSArICcpICcgKyBjb3B5W2ldLm1lc3NhZ2U7XG4gICAgICAgIGVyciA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGVyciA/IGNvbnNvbGUuZXJyb3IuYXBwbHkoY29uc29sZSwgY29weSkgOiBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBjb3B5KTtcbiAgfSxcbiAgLy9cblxuICAvLyBSZXR1cm5zIGJyb3dzZXItYWdub3N0aWMgZGVmYXVsdCBjb25maWdcbiAgZGVmYXVsdENvbmZpZzogZGVmYXVsdENvbmZpZyxcbiAgLy9cblxuICAvLyBSZXR1cm5zIHRoZSBjdXJyZW50IGJyb3dzZXIuXG4gIGJyb3dzZXI6IChmdW5jdGlvbigpIHtcbiAgICBpZiAod2luZG93Lm1velJUQ1BlZXJDb25uZWN0aW9uKSB7XG4gICAgICByZXR1cm4gJ0ZpcmVmb3gnO1xuICAgIH0gZWxzZSBpZiAod2luZG93LndlYmtpdFJUQ1BlZXJDb25uZWN0aW9uKSB7XG4gICAgICByZXR1cm4gJ0Nocm9tZSc7XG4gICAgfSBlbHNlIGlmICh3aW5kb3cuUlRDUGVlckNvbm5lY3Rpb24pIHtcbiAgICAgIHJldHVybiAnU3VwcG9ydGVkJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICdVbnN1cHBvcnRlZCc7XG4gICAgfVxuICB9KSgpLFxuICAvL1xuXG4gIC8vIExpc3RzIHdoaWNoIGZlYXR1cmVzIGFyZSBzdXBwb3J0ZWRcbiAgc3VwcG9ydHM6IChmdW5jdGlvbigpIHtcbiAgICBpZiAodHlwZW9mIFJUQ1BlZXJDb25uZWN0aW9uID09PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIHZhciBkYXRhID0gdHJ1ZTtcbiAgICB2YXIgYXVkaW9WaWRlbyA9IHRydWU7XG5cbiAgICB2YXIgYmluYXJ5QmxvYiA9IGZhbHNlO1xuICAgIHZhciBzY3RwID0gZmFsc2U7XG4gICAgdmFyIG9ubmVnb3RpYXRpb25uZWVkZWQgPSAhIXdpbmRvdy53ZWJraXRSVENQZWVyQ29ubmVjdGlvbjtcblxuICAgIHZhciBwYywgZGM7XG4gICAgdHJ5IHtcbiAgICAgIHBjID0gbmV3IFJUQ1BlZXJDb25uZWN0aW9uKGRlZmF1bHRDb25maWcsIHtvcHRpb25hbDogW3tSdHBEYXRhQ2hhbm5lbHM6IHRydWV9XX0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGRhdGEgPSBmYWxzZTtcbiAgICAgIGF1ZGlvVmlkZW8gPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgZGMgPSBwYy5jcmVhdGVEYXRhQ2hhbm5lbCgnX1BFRVJKU1RFU1QnKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZGF0YSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChkYXRhKSB7XG4gICAgICAvLyBCaW5hcnkgdGVzdFxuICAgICAgdHJ5IHtcbiAgICAgICAgZGMuYmluYXJ5VHlwZSA9ICdibG9iJztcbiAgICAgICAgYmluYXJ5QmxvYiA9IHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbGlhYmxlIHRlc3QuXG4gICAgICAvLyBVbmZvcnR1bmF0ZWx5IENocm9tZSBpcyBhIGJpdCB1bnJlbGlhYmxlIGFib3V0IHdoZXRoZXIgb3Igbm90IHRoZXlcbiAgICAgIC8vIHN1cHBvcnQgcmVsaWFibGUuXG4gICAgICB2YXIgcmVsaWFibGVQQyA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihkZWZhdWx0Q29uZmlnLCB7fSk7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgcmVsaWFibGVEQyA9IHJlbGlhYmxlUEMuY3JlYXRlRGF0YUNoYW5uZWwoJ19QRUVSSlNSRUxJQUJMRVRFU1QnLCB7fSk7XG4gICAgICAgIHNjdHAgPSByZWxpYWJsZURDLnJlbGlhYmxlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgfVxuICAgICAgcmVsaWFibGVQQy5jbG9zZSgpO1xuICAgIH1cblxuICAgIC8vIEZJWE1FOiBub3QgcmVhbGx5IHRoZSBiZXN0IGNoZWNrLi4uXG4gICAgaWYgKGF1ZGlvVmlkZW8pIHtcbiAgICAgIGF1ZGlvVmlkZW8gPSAhIXBjLmFkZFN0cmVhbTtcbiAgICB9XG5cbiAgICAvLyBGSVhNRTogdGhpcyBpcyBub3QgZ3JlYXQgYmVjYXVzZSBpbiB0aGVvcnkgaXQgZG9lc24ndCB3b3JrIGZvclxuICAgIC8vIGF2LW9ubHkgYnJvd3NlcnMgKD8pLlxuICAgIGlmICghb25uZWdvdGlhdGlvbm5lZWRlZCAmJiBkYXRhKSB7XG4gICAgICAvLyBzeW5jIGRlZmF1bHQgY2hlY2suXG4gICAgICB2YXIgbmVnb3RpYXRpb25QQyA9IG5ldyBSVENQZWVyQ29ubmVjdGlvbihkZWZhdWx0Q29uZmlnLCB7b3B0aW9uYWw6IFt7UnRwRGF0YUNoYW5uZWxzOiB0cnVlfV19KTtcbiAgICAgIG5lZ290aWF0aW9uUEMub25uZWdvdGlhdGlvbm5lZWRlZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBvbm5lZ290aWF0aW9ubmVlZGVkID0gdHJ1ZTtcbiAgICAgICAgLy8gYXN5bmMgY2hlY2suXG4gICAgICAgIGlmICh1dGlsICYmIHV0aWwuc3VwcG9ydHMpIHtcbiAgICAgICAgICB1dGlsLnN1cHBvcnRzLm9ubmVnb3RpYXRpb25uZWVkZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgbmVnb3RpYXRpb25QQy5jcmVhdGVEYXRhQ2hhbm5lbCgnX1BFRVJKU05FR09USUFUSU9OVEVTVCcpO1xuXG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBuZWdvdGlhdGlvblBDLmNsb3NlKCk7XG4gICAgICB9LCAxMDAwKTtcbiAgICB9XG5cbiAgICBpZiAocGMpIHtcbiAgICAgIHBjLmNsb3NlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGF1ZGlvVmlkZW86IGF1ZGlvVmlkZW8sXG4gICAgICBkYXRhOiBkYXRhLFxuICAgICAgYmluYXJ5QmxvYjogYmluYXJ5QmxvYixcbiAgICAgIGJpbmFyeTogc2N0cCwgLy8gZGVwcmVjYXRlZDsgc2N0cCBpbXBsaWVzIGJpbmFyeSBzdXBwb3J0LlxuICAgICAgcmVsaWFibGU6IHNjdHAsIC8vIGRlcHJlY2F0ZWQ7IHNjdHAgaW1wbGllcyByZWxpYWJsZSBkYXRhLlxuICAgICAgc2N0cDogc2N0cCxcbiAgICAgIG9ubmVnb3RpYXRpb25uZWVkZWQ6IG9ubmVnb3RpYXRpb25uZWVkZWRcbiAgICB9O1xuICB9KCkpLFxuICAvL1xuXG4gIC8vIEVuc3VyZSBhbHBoYW51bWVyaWMgaWRzXG4gIHZhbGlkYXRlSWQ6IGZ1bmN0aW9uKGlkKSB7XG4gICAgLy8gQWxsb3cgZW1wdHkgaWRzXG4gICAgcmV0dXJuICFpZCB8fCAvXltBLVphLXowLTldKyg/OlsgXy1dW0EtWmEtejAtOV0rKSokLy5leGVjKGlkKTtcbiAgfSxcblxuICB2YWxpZGF0ZUtleTogZnVuY3Rpb24oa2V5KSB7XG4gICAgLy8gQWxsb3cgZW1wdHkga2V5c1xuICAgIHJldHVybiAha2V5IHx8IC9eW0EtWmEtejAtOV0rKD86WyBfLV1bQS1aYS16MC05XSspKiQvLmV4ZWMoa2V5KTtcbiAgfSxcblxuXG4gIGRlYnVnOiBmYWxzZSxcblxuICBpbmhlcml0czogZnVuY3Rpb24oY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3I7XG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBleHRlbmQ6IGZ1bmN0aW9uKGRlc3QsIHNvdXJjZSkge1xuICAgIGZvcih2YXIga2V5IGluIHNvdXJjZSkge1xuICAgICAgaWYoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgZGVzdFtrZXldID0gc291cmNlW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkZXN0O1xuICB9LFxuICBwYWNrOiBCaW5hcnlQYWNrLnBhY2ssXG4gIHVucGFjazogQmluYXJ5UGFjay51bnBhY2ssXG5cbiAgbG9nOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHV0aWwuZGVidWcpIHtcbiAgICAgIHZhciBlcnIgPSBmYWxzZTtcbiAgICAgIHZhciBjb3B5ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIGNvcHkudW5zaGlmdCgnUGVlckpTOiAnKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY29weS5sZW5ndGg7IGkgPCBsOyBpKyspe1xuICAgICAgICBpZiAoY29weVtpXSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgY29weVtpXSA9ICcoJyArIGNvcHlbaV0ubmFtZSArICcpICcgKyBjb3B5W2ldLm1lc3NhZ2U7XG4gICAgICAgICAgZXJyID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZXJyID8gY29uc29sZS5lcnJvci5hcHBseShjb25zb2xlLCBjb3B5KSA6IGNvbnNvbGUubG9nLmFwcGx5KGNvbnNvbGUsIGNvcHkpO1xuICAgIH1cbiAgfSxcblxuICBzZXRaZXJvVGltZW91dDogKGZ1bmN0aW9uKGdsb2JhbCkge1xuICAgIHZhciB0aW1lb3V0cyA9IFtdO1xuICAgIHZhciBtZXNzYWdlTmFtZSA9ICd6ZXJvLXRpbWVvdXQtbWVzc2FnZSc7XG5cbiAgICAvLyBMaWtlIHNldFRpbWVvdXQsIGJ1dCBvbmx5IHRha2VzIGEgZnVuY3Rpb24gYXJndW1lbnQuXHQgVGhlcmUnc1xuICAgIC8vIG5vIHRpbWUgYXJndW1lbnQgKGFsd2F5cyB6ZXJvKSBhbmQgbm8gYXJndW1lbnRzICh5b3UgaGF2ZSB0b1xuICAgIC8vIHVzZSBhIGNsb3N1cmUpLlxuICAgIGZ1bmN0aW9uIHNldFplcm9UaW1lb3V0UG9zdE1lc3NhZ2UoZm4pIHtcbiAgICAgIHRpbWVvdXRzLnB1c2goZm4pO1xuICAgICAgZ2xvYmFsLnBvc3RNZXNzYWdlKG1lc3NhZ2VOYW1lLCAnKicpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZU1lc3NhZ2UoZXZlbnQpIHtcbiAgICAgIGlmIChldmVudC5zb3VyY2UgPT0gZ2xvYmFsICYmIGV2ZW50LmRhdGEgPT0gbWVzc2FnZU5hbWUpIHtcbiAgICAgICAgaWYgKGV2ZW50LnN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aW1lb3V0cy5sZW5ndGgpIHtcbiAgICAgICAgICB0aW1lb3V0cy5zaGlmdCgpKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGdsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGhhbmRsZU1lc3NhZ2UsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoZ2xvYmFsLmF0dGFjaEV2ZW50KSB7XG4gICAgICBnbG9iYWwuYXR0YWNoRXZlbnQoJ29ubWVzc2FnZScsIGhhbmRsZU1lc3NhZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gc2V0WmVyb1RpbWVvdXRQb3N0TWVzc2FnZTtcbiAgfSh3aW5kb3cpKSxcblxuICAvLyBCaW5hcnkgc3R1ZmZcblxuICAvLyBjaHVua3MgYSBibG9iLlxuICBjaHVuazogZnVuY3Rpb24oYmwpIHtcbiAgICB2YXIgY2h1bmtzID0gW107XG4gICAgdmFyIHNpemUgPSBibC5zaXplO1xuICAgIHZhciBzdGFydCA9IGluZGV4ID0gMDtcbiAgICB2YXIgdG90YWwgPSBNYXRoLmNlaWwoc2l6ZSAvIHV0aWwuY2h1bmtlZE1UVSk7XG4gICAgd2hpbGUgKHN0YXJ0IDwgc2l6ZSkge1xuICAgICAgdmFyIGVuZCA9IE1hdGgubWluKHNpemUsIHN0YXJ0ICsgdXRpbC5jaHVua2VkTVRVKTtcbiAgICAgIHZhciBiID0gYmwuc2xpY2Uoc3RhcnQsIGVuZCk7XG5cbiAgICAgIHZhciBjaHVuayA9IHtcbiAgICAgICAgX19wZWVyRGF0YTogZGF0YUNvdW50LFxuICAgICAgICBuOiBpbmRleCxcbiAgICAgICAgZGF0YTogYixcbiAgICAgICAgdG90YWw6IHRvdGFsXG4gICAgICB9O1xuXG4gICAgICBjaHVua3MucHVzaChjaHVuayk7XG5cbiAgICAgIHN0YXJ0ID0gZW5kO1xuICAgICAgaW5kZXggKz0gMTtcbiAgICB9XG4gICAgZGF0YUNvdW50ICs9IDE7XG4gICAgcmV0dXJuIGNodW5rcztcbiAgfSxcblxuICBibG9iVG9BcnJheUJ1ZmZlcjogZnVuY3Rpb24oYmxvYiwgY2Ipe1xuICAgIHZhciBmciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgZnIub25sb2FkID0gZnVuY3Rpb24oZXZ0KSB7XG4gICAgICBjYihldnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgfTtcbiAgICBmci5yZWFkQXNBcnJheUJ1ZmZlcihibG9iKTtcbiAgfSxcbiAgYmxvYlRvQmluYXJ5U3RyaW5nOiBmdW5jdGlvbihibG9iLCBjYil7XG4gICAgdmFyIGZyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICBmci5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcbiAgICAgIGNiKGV2dC50YXJnZXQucmVzdWx0KTtcbiAgICB9O1xuICAgIGZyLnJlYWRBc0JpbmFyeVN0cmluZyhibG9iKTtcbiAgfSxcbiAgYmluYXJ5U3RyaW5nVG9BcnJheUJ1ZmZlcjogZnVuY3Rpb24oYmluYXJ5KSB7XG4gICAgdmFyIGJ5dGVBcnJheSA9IG5ldyBVaW50OEFycmF5KGJpbmFyeS5sZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYmluYXJ5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBieXRlQXJyYXlbaV0gPSBiaW5hcnkuY2hhckNvZGVBdChpKSAmIDB4ZmY7XG4gICAgfVxuICAgIHJldHVybiBieXRlQXJyYXkuYnVmZmVyO1xuICB9LFxuICByYW5kb21Ub2tlbjogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMik7XG4gIH0sXG4gIC8vXG5cbiAgaXNTZWN1cmU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBsb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHBzOic7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gdXRpbDtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBSZXByZXNlbnRhdGlvbiBvZiBhIHNpbmdsZSBFdmVudEVtaXR0ZXIgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gRXZlbnQgaGFuZGxlciB0byBiZSBjYWxsZWQuXG4gKiBAcGFyYW0ge01peGVkfSBjb250ZXh0IENvbnRleHQgZm9yIGZ1bmN0aW9uIGV4ZWN1dGlvbi5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb25jZSBPbmx5IGVtaXQgb25jZVxuICogQGFwaSBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIEVFKGZuLCBjb250ZXh0LCBvbmNlKSB7XG4gIHRoaXMuZm4gPSBmbjtcbiAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgdGhpcy5vbmNlID0gb25jZSB8fCBmYWxzZTtcbn1cblxuLyoqXG4gKiBNaW5pbWFsIEV2ZW50RW1pdHRlciBpbnRlcmZhY2UgdGhhdCBpcyBtb2xkZWQgYWdhaW5zdCB0aGUgTm9kZS5qc1xuICogRXZlbnRFbWl0dGVyIGludGVyZmFjZS5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBhcGkgcHVibGljXG4gKi9cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHsgLyogTm90aGluZyB0byBzZXQgKi8gfVxuXG4vKipcbiAqIEhvbGRzIHRoZSBhc3NpZ25lZCBFdmVudEVtaXR0ZXJzIGJ5IG5hbWUuXG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqIEBwcml2YXRlXG4gKi9cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcblxuLyoqXG4gKiBSZXR1cm4gYSBsaXN0IG9mIGFzc2lnbmVkIGV2ZW50IGxpc3RlbmVycy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgVGhlIGV2ZW50cyB0aGF0IHNob3VsZCBiZSBsaXN0ZWQuXG4gKiBAcmV0dXJucyB7QXJyYXl9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uIGxpc3RlbmVycyhldmVudCkge1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW2V2ZW50XSkgcmV0dXJuIFtdO1xuICBpZiAodGhpcy5fZXZlbnRzW2V2ZW50XS5mbikgcmV0dXJuIFt0aGlzLl9ldmVudHNbZXZlbnRdLmZuXTtcblxuICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuX2V2ZW50c1tldmVudF0ubGVuZ3RoLCBlZSA9IG5ldyBBcnJheShsKTsgaSA8IGw7IGkrKykge1xuICAgIGVlW2ldID0gdGhpcy5fZXZlbnRzW2V2ZW50XVtpXS5mbjtcbiAgfVxuXG4gIHJldHVybiBlZTtcbn07XG5cbi8qKlxuICogRW1pdCBhbiBldmVudCB0byBhbGwgcmVnaXN0ZXJlZCBldmVudCBsaXN0ZW5lcnMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IFRoZSBuYW1lIG9mIHRoZSBldmVudC5cbiAqIEByZXR1cm5zIHtCb29sZWFufSBJbmRpY2F0aW9uIGlmIHdlJ3ZlIGVtaXR0ZWQgYW4gZXZlbnQuXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiBlbWl0KGV2ZW50LCBhMSwgYTIsIGEzLCBhNCwgYTUpIHtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1tldmVudF0pIHJldHVybiBmYWxzZTtcblxuICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW2V2ZW50XVxuICAgICwgbGVuID0gYXJndW1lbnRzLmxlbmd0aFxuICAgICwgYXJnc1xuICAgICwgaTtcblxuICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGxpc3RlbmVycy5mbikge1xuICAgIGlmIChsaXN0ZW5lcnMub25jZSkgdGhpcy5yZW1vdmVMaXN0ZW5lcihldmVudCwgbGlzdGVuZXJzLmZuLCB0cnVlKTtcblxuICAgIHN3aXRjaCAobGVuKSB7XG4gICAgICBjYXNlIDE6IHJldHVybiBsaXN0ZW5lcnMuZm4uY2FsbChsaXN0ZW5lcnMuY29udGV4dCksIHRydWU7XG4gICAgICBjYXNlIDI6IHJldHVybiBsaXN0ZW5lcnMuZm4uY2FsbChsaXN0ZW5lcnMuY29udGV4dCwgYTEpLCB0cnVlO1xuICAgICAgY2FzZSAzOiByZXR1cm4gbGlzdGVuZXJzLmZuLmNhbGwobGlzdGVuZXJzLmNvbnRleHQsIGExLCBhMiksIHRydWU7XG4gICAgICBjYXNlIDQ6IHJldHVybiBsaXN0ZW5lcnMuZm4uY2FsbChsaXN0ZW5lcnMuY29udGV4dCwgYTEsIGEyLCBhMyksIHRydWU7XG4gICAgICBjYXNlIDU6IHJldHVybiBsaXN0ZW5lcnMuZm4uY2FsbChsaXN0ZW5lcnMuY29udGV4dCwgYTEsIGEyLCBhMywgYTQpLCB0cnVlO1xuICAgICAgY2FzZSA2OiByZXR1cm4gbGlzdGVuZXJzLmZuLmNhbGwobGlzdGVuZXJzLmNvbnRleHQsIGExLCBhMiwgYTMsIGE0LCBhNSksIHRydWU7XG4gICAgfVxuXG4gICAgZm9yIChpID0gMSwgYXJncyA9IG5ldyBBcnJheShsZW4gLTEpOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgIH1cblxuICAgIGxpc3RlbmVycy5mbi5hcHBseShsaXN0ZW5lcnMuY29udGV4dCwgYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGxlbmd0aCA9IGxpc3RlbmVycy5sZW5ndGhcbiAgICAgICwgajtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGxpc3RlbmVyc1tpXS5vbmNlKSB0aGlzLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lcnNbaV0uZm4sIHRydWUpO1xuXG4gICAgICBzd2l0Y2ggKGxlbikge1xuICAgICAgICBjYXNlIDE6IGxpc3RlbmVyc1tpXS5mbi5jYWxsKGxpc3RlbmVyc1tpXS5jb250ZXh0KTsgYnJlYWs7XG4gICAgICAgIGNhc2UgMjogbGlzdGVuZXJzW2ldLmZuLmNhbGwobGlzdGVuZXJzW2ldLmNvbnRleHQsIGExKTsgYnJlYWs7XG4gICAgICAgIGNhc2UgMzogbGlzdGVuZXJzW2ldLmZuLmNhbGwobGlzdGVuZXJzW2ldLmNvbnRleHQsIGExLCBhMik7IGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmICghYXJncykgZm9yIChqID0gMSwgYXJncyA9IG5ldyBBcnJheShsZW4gLTEpOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaiAtIDFdID0gYXJndW1lbnRzW2pdO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpc3RlbmVyc1tpXS5mbi5hcHBseShsaXN0ZW5lcnNbaV0uY29udGV4dCwgYXJncyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vKipcbiAqIFJlZ2lzdGVyIGEgbmV3IEV2ZW50TGlzdGVuZXIgZm9yIHRoZSBnaXZlbiBldmVudC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgTmFtZSBvZiB0aGUgZXZlbnQuXG4gKiBAcGFyYW0ge0Z1bmN0b259IGZuIENhbGxiYWNrIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtNaXhlZH0gY29udGV4dCBUaGUgY29udGV4dCBvZiB0aGUgZnVuY3Rpb24uXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gb24oZXZlbnQsIGZuLCBjb250ZXh0KSB7XG4gIHZhciBsaXN0ZW5lciA9IG5ldyBFRShmbiwgY29udGV4dCB8fCB0aGlzKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cykgdGhpcy5fZXZlbnRzID0ge307XG4gIGlmICghdGhpcy5fZXZlbnRzW2V2ZW50XSkgdGhpcy5fZXZlbnRzW2V2ZW50XSA9IGxpc3RlbmVyO1xuICBlbHNlIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50c1tldmVudF0uZm4pIHRoaXMuX2V2ZW50c1tldmVudF0ucHVzaChsaXN0ZW5lcik7XG4gICAgZWxzZSB0aGlzLl9ldmVudHNbZXZlbnRdID0gW1xuICAgICAgdGhpcy5fZXZlbnRzW2V2ZW50XSwgbGlzdGVuZXJcbiAgICBdO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFkZCBhbiBFdmVudExpc3RlbmVyIHRoYXQncyBvbmx5IGNhbGxlZCBvbmNlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBOYW1lIG9mIHRoZSBldmVudC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIENhbGxiYWNrIGZ1bmN0aW9uLlxuICogQHBhcmFtIHtNaXhlZH0gY29udGV4dCBUaGUgY29udGV4dCBvZiB0aGUgZnVuY3Rpb24uXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbiBvbmNlKGV2ZW50LCBmbiwgY29udGV4dCkge1xuICB2YXIgbGlzdGVuZXIgPSBuZXcgRUUoZm4sIGNvbnRleHQgfHwgdGhpcywgdHJ1ZSk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpIHRoaXMuX2V2ZW50cyA9IHt9O1xuICBpZiAoIXRoaXMuX2V2ZW50c1tldmVudF0pIHRoaXMuX2V2ZW50c1tldmVudF0gPSBsaXN0ZW5lcjtcbiAgZWxzZSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHNbZXZlbnRdLmZuKSB0aGlzLl9ldmVudHNbZXZlbnRdLnB1c2gobGlzdGVuZXIpO1xuICAgIGVsc2UgdGhpcy5fZXZlbnRzW2V2ZW50XSA9IFtcbiAgICAgIHRoaXMuX2V2ZW50c1tldmVudF0sIGxpc3RlbmVyXG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgZXZlbnQgbGlzdGVuZXJzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBUaGUgZXZlbnQgd2Ugd2FudCB0byByZW1vdmUuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgbGlzdGVuZXIgdGhhdCB3ZSBuZWVkIHRvIGZpbmQuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9uY2UgT25seSByZW1vdmUgb25jZSBsaXN0ZW5lcnMuXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24gcmVtb3ZlTGlzdGVuZXIoZXZlbnQsIGZuLCBvbmNlKSB7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbZXZlbnRdKSByZXR1cm4gdGhpcztcblxuICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW2V2ZW50XVxuICAgICwgZXZlbnRzID0gW107XG5cbiAgaWYgKGZuKSB7XG4gICAgaWYgKGxpc3RlbmVycy5mbiAmJiAobGlzdGVuZXJzLmZuICE9PSBmbiB8fCAob25jZSAmJiAhbGlzdGVuZXJzLm9uY2UpKSkge1xuICAgICAgZXZlbnRzLnB1c2gobGlzdGVuZXJzKTtcbiAgICB9XG4gICAgaWYgKCFsaXN0ZW5lcnMuZm4pIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChsaXN0ZW5lcnNbaV0uZm4gIT09IGZuIHx8IChvbmNlICYmICFsaXN0ZW5lcnNbaV0ub25jZSkpIHtcbiAgICAgICAgZXZlbnRzLnB1c2gobGlzdGVuZXJzW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvL1xuICAvLyBSZXNldCB0aGUgYXJyYXksIG9yIHJlbW92ZSBpdCBjb21wbGV0ZWx5IGlmIHdlIGhhdmUgbm8gbW9yZSBsaXN0ZW5lcnMuXG4gIC8vXG4gIGlmIChldmVudHMubGVuZ3RoKSB7XG4gICAgdGhpcy5fZXZlbnRzW2V2ZW50XSA9IGV2ZW50cy5sZW5ndGggPT09IDEgPyBldmVudHNbMF0gOiBldmVudHM7XG4gIH0gZWxzZSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1tldmVudF07XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogUmVtb3ZlIGFsbCBsaXN0ZW5lcnMgb3Igb25seSB0aGUgbGlzdGVuZXJzIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCBUaGUgZXZlbnQgd2FudCB0byByZW1vdmUgYWxsIGxpc3RlbmVycyBmb3IuXG4gKiBAYXBpIHB1YmxpY1xuICovXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uIHJlbW92ZUFsbExpc3RlbmVycyhldmVudCkge1xuICBpZiAoIXRoaXMuX2V2ZW50cykgcmV0dXJuIHRoaXM7XG5cbiAgaWYgKGV2ZW50KSBkZWxldGUgdGhpcy5fZXZlbnRzW2V2ZW50XTtcbiAgZWxzZSB0aGlzLl9ldmVudHMgPSB7fTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vXG4vLyBBbGlhcyBtZXRob2RzIG5hbWVzIGJlY2F1c2UgcGVvcGxlIHJvbGwgbGlrZSB0aGF0LlxuLy9cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub2ZmID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lcjtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uO1xuXG4vL1xuLy8gVGhpcyBmdW5jdGlvbiBkb2Vzbid0IGFwcGx5IGFueW1vcmUuXG4vL1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbiBzZXRNYXhMaXN0ZW5lcnMoKSB7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLy9cbi8vIEV4cG9zZSB0aGUgbW9kdWxlLlxuLy9cbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjtcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIzID0gRXZlbnRFbWl0dGVyO1xuXG4vL1xuLy8gRXhwb3NlIHRoZSBtb2R1bGUuXG4vL1xubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG4iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuXG4vKipcbiAqIFJlbGlhYmxlIHRyYW5zZmVyIGZvciBDaHJvbWUgQ2FuYXJ5IERhdGFDaGFubmVsIGltcGwuXG4gKiBBdXRob3I6IEBtaWNoZWxsZWJ1XG4gKi9cbmZ1bmN0aW9uIFJlbGlhYmxlKGRjLCBkZWJ1Zykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUmVsaWFibGUpKSByZXR1cm4gbmV3IFJlbGlhYmxlKGRjKTtcbiAgdGhpcy5fZGMgPSBkYztcblxuICB1dGlsLmRlYnVnID0gZGVidWc7XG5cbiAgLy8gTWVzc2FnZXMgc2VudC9yZWNlaXZlZCBzbyBmYXIuXG4gIC8vIGlkOiB7IGFjazogbiwgY2h1bmtzOiBbLi4uXSB9XG4gIHRoaXMuX291dGdvaW5nID0ge307XG4gIC8vIGlkOiB7IGFjazogWydhY2snLCBpZCwgbl0sIGNodW5rczogWy4uLl0gfVxuICB0aGlzLl9pbmNvbWluZyA9IHt9O1xuICB0aGlzLl9yZWNlaXZlZCA9IHt9O1xuXG4gIC8vIFdpbmRvdyBzaXplLlxuICB0aGlzLl93aW5kb3cgPSAxMDAwO1xuICAvLyBNVFUuXG4gIHRoaXMuX210dSA9IDUwMDtcbiAgLy8gSW50ZXJ2YWwgZm9yIHNldEludGVydmFsLiBJbiBtcy5cbiAgdGhpcy5faW50ZXJ2YWwgPSAwO1xuXG4gIC8vIE1lc3NhZ2VzIHNlbnQuXG4gIHRoaXMuX2NvdW50ID0gMDtcblxuICAvLyBPdXRnb2luZyBtZXNzYWdlIHF1ZXVlLlxuICB0aGlzLl9xdWV1ZSA9IFtdO1xuXG4gIHRoaXMuX3NldHVwREMoKTtcbn07XG5cbi8vIFNlbmQgYSBtZXNzYWdlIHJlbGlhYmx5LlxuUmVsaWFibGUucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbihtc2cpIHtcbiAgLy8gRGV0ZXJtaW5lIGlmIGNodW5raW5nIGlzIG5lY2Vzc2FyeS5cbiAgdmFyIGJsID0gdXRpbC5wYWNrKG1zZyk7XG4gIGlmIChibC5zaXplIDwgdGhpcy5fbXR1KSB7XG4gICAgdGhpcy5faGFuZGxlU2VuZChbJ25vJywgYmxdKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLl9vdXRnb2luZ1t0aGlzLl9jb3VudF0gPSB7XG4gICAgYWNrOiAwLFxuICAgIGNodW5rczogdGhpcy5fY2h1bmsoYmwpXG4gIH07XG5cbiAgaWYgKHV0aWwuZGVidWcpIHtcbiAgICB0aGlzLl9vdXRnb2luZ1t0aGlzLl9jb3VudF0udGltZXIgPSBuZXcgRGF0ZSgpO1xuICB9XG5cbiAgLy8gU2VuZCBwcmVsaW0gd2luZG93LlxuICB0aGlzLl9zZW5kV2luZG93ZWRDaHVua3ModGhpcy5fY291bnQpO1xuICB0aGlzLl9jb3VudCArPSAxO1xufTtcblxuLy8gU2V0IHVwIGludGVydmFsIGZvciBwcm9jZXNzaW5nIHF1ZXVlLlxuUmVsaWFibGUucHJvdG90eXBlLl9zZXR1cEludGVydmFsID0gZnVuY3Rpb24oKSB7XG4gIC8vIFRPRE86IGZhaWwgZ3JhY2VmdWxseS5cblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMuX3RpbWVvdXQgPSBzZXRJbnRlcnZhbChmdW5jdGlvbigpIHtcbiAgICAvLyBGSVhNRTogU3RyaW5nIHN0dWZmIG1ha2VzIHRoaW5ncyB0ZXJyaWJseSBhc3luYy5cbiAgICB2YXIgbXNnID0gc2VsZi5fcXVldWUuc2hpZnQoKTtcbiAgICBpZiAobXNnLl9tdWx0aXBsZSkge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGlpID0gbXNnLmxlbmd0aDsgaSA8IGlpOyBpICs9IDEpIHtcbiAgICAgICAgc2VsZi5faW50ZXJ2YWxTZW5kKG1zZ1tpXSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX2ludGVydmFsU2VuZChtc2cpO1xuICAgIH1cbiAgfSwgdGhpcy5faW50ZXJ2YWwpO1xufTtcblxuUmVsaWFibGUucHJvdG90eXBlLl9pbnRlcnZhbFNlbmQgPSBmdW5jdGlvbihtc2cpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBtc2cgPSB1dGlsLnBhY2sobXNnKTtcbiAgdXRpbC5ibG9iVG9CaW5hcnlTdHJpbmcobXNnLCBmdW5jdGlvbihzdHIpIHtcbiAgICBzZWxmLl9kYy5zZW5kKHN0cik7XG4gIH0pO1xuICBpZiAoc2VsZi5fcXVldWUubGVuZ3RoID09PSAwKSB7XG4gICAgY2xlYXJUaW1lb3V0KHNlbGYuX3RpbWVvdXQpO1xuICAgIHNlbGYuX3RpbWVvdXQgPSBudWxsO1xuICAgIC8vc2VsZi5fcHJvY2Vzc0Fja3MoKTtcbiAgfVxufTtcblxuLy8gR28gdGhyb3VnaCBBQ0tzIHRvIHNlbmQgbWlzc2luZyBwaWVjZXMuXG5SZWxpYWJsZS5wcm90b3R5cGUuX3Byb2Nlc3NBY2tzID0gZnVuY3Rpb24oKSB7XG4gIGZvciAodmFyIGlkIGluIHRoaXMuX291dGdvaW5nKSB7XG4gICAgaWYgKHRoaXMuX291dGdvaW5nLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgdGhpcy5fc2VuZFdpbmRvd2VkQ2h1bmtzKGlkKTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIEhhbmRsZSBzZW5kaW5nIGEgbWVzc2FnZS5cbi8vIEZJWE1FOiBEb24ndCB3YWl0IGZvciBpbnRlcnZhbCB0aW1lIGZvciBhbGwgbWVzc2FnZXMuLi5cblJlbGlhYmxlLnByb3RvdHlwZS5faGFuZGxlU2VuZCA9IGZ1bmN0aW9uKG1zZykge1xuICB2YXIgcHVzaCA9IHRydWU7XG4gIGZvciAodmFyIGkgPSAwLCBpaSA9IHRoaXMuX3F1ZXVlLmxlbmd0aDsgaSA8IGlpOyBpICs9IDEpIHtcbiAgICB2YXIgaXRlbSA9IHRoaXMuX3F1ZXVlW2ldO1xuICAgIGlmIChpdGVtID09PSBtc2cpIHtcbiAgICAgIHB1c2ggPSBmYWxzZTtcbiAgICB9IGVsc2UgaWYgKGl0ZW0uX211bHRpcGxlICYmIGl0ZW0uaW5kZXhPZihtc2cpICE9PSAtMSkge1xuICAgICAgcHVzaCA9IGZhbHNlO1xuICAgIH1cbiAgfVxuICBpZiAocHVzaCkge1xuICAgIHRoaXMuX3F1ZXVlLnB1c2gobXNnKTtcbiAgICBpZiAoIXRoaXMuX3RpbWVvdXQpIHtcbiAgICAgIHRoaXMuX3NldHVwSW50ZXJ2YWwoKTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIFNldCB1cCBEYXRhQ2hhbm5lbCBoYW5kbGVycy5cblJlbGlhYmxlLnByb3RvdHlwZS5fc2V0dXBEQyA9IGZ1bmN0aW9uKCkge1xuICAvLyBIYW5kbGUgdmFyaW91cyBtZXNzYWdlIHR5cGVzLlxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMuX2RjLm9ubWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgbXNnID0gZS5kYXRhO1xuICAgIHZhciBkYXRhdHlwZSA9IG1zZy5jb25zdHJ1Y3RvcjtcbiAgICAvLyBGSVhNRTogbXNnIGlzIFN0cmluZyB1bnRpbCBiaW5hcnkgaXMgc3VwcG9ydGVkLlxuICAgIC8vIE9uY2UgdGhhdCBoYXBwZW5zLCB0aGlzIHdpbGwgaGF2ZSB0byBiZSBzbWFydGVyLlxuICAgIGlmIChkYXRhdHlwZSA9PT0gU3RyaW5nKSB7XG4gICAgICB2YXIgYWIgPSB1dGlsLmJpbmFyeVN0cmluZ1RvQXJyYXlCdWZmZXIobXNnKTtcbiAgICAgIG1zZyA9IHV0aWwudW5wYWNrKGFiKTtcbiAgICAgIHNlbGYuX2hhbmRsZU1lc3NhZ2UobXNnKTtcbiAgICB9XG4gIH07XG59O1xuXG4vLyBIYW5kbGVzIGFuIGluY29taW5nIG1lc3NhZ2UuXG5SZWxpYWJsZS5wcm90b3R5cGUuX2hhbmRsZU1lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHtcbiAgdmFyIGlkID0gbXNnWzFdO1xuICB2YXIgaWRhdGEgPSB0aGlzLl9pbmNvbWluZ1tpZF07XG4gIHZhciBvZGF0YSA9IHRoaXMuX291dGdvaW5nW2lkXTtcbiAgdmFyIGRhdGE7XG4gIHN3aXRjaCAobXNnWzBdKSB7XG4gICAgLy8gTm8gY2h1bmtpbmcgd2FzIGRvbmUuXG4gICAgY2FzZSAnbm8nOlxuICAgICAgdmFyIG1lc3NhZ2UgPSBpZDtcbiAgICAgIGlmICghIW1lc3NhZ2UpIHtcbiAgICAgICAgdGhpcy5vbm1lc3NhZ2UodXRpbC51bnBhY2sobWVzc2FnZSkpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgLy8gUmVhY2hlZCB0aGUgZW5kIG9mIHRoZSBtZXNzYWdlLlxuICAgIGNhc2UgJ2VuZCc6XG4gICAgICBkYXRhID0gaWRhdGE7XG5cbiAgICAgIC8vIEluIGNhc2UgZW5kIGNvbWVzIGZpcnN0LlxuICAgICAgdGhpcy5fcmVjZWl2ZWRbaWRdID0gbXNnWzJdO1xuXG4gICAgICBpZiAoIWRhdGEpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2FjayhpZCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdhY2snOlxuICAgICAgZGF0YSA9IG9kYXRhO1xuICAgICAgaWYgKCEhZGF0YSkge1xuICAgICAgICB2YXIgYWNrID0gbXNnWzJdO1xuICAgICAgICAvLyBUYWtlIHRoZSBsYXJnZXIgQUNLLCBmb3Igb3V0IG9mIG9yZGVyIG1lc3NhZ2VzLlxuICAgICAgICBkYXRhLmFjayA9IE1hdGgubWF4KGFjaywgZGF0YS5hY2spO1xuXG4gICAgICAgIC8vIENsZWFuIHVwIHdoZW4gYWxsIGNodW5rcyBhcmUgQUNLZWQuXG4gICAgICAgIGlmIChkYXRhLmFjayA+PSBkYXRhLmNodW5rcy5sZW5ndGgpIHtcbiAgICAgICAgICB1dGlsLmxvZygnVGltZTogJywgbmV3IERhdGUoKSAtIGRhdGEudGltZXIpO1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9vdXRnb2luZ1tpZF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5fcHJvY2Vzc0Fja3MoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gSWYgIWRhdGEsIGp1c3QgaWdub3JlLlxuICAgICAgYnJlYWs7XG4gICAgLy8gUmVjZWl2ZWQgYSBjaHVuayBvZiBkYXRhLlxuICAgIGNhc2UgJ2NodW5rJzpcbiAgICAgIC8vIENyZWF0ZSBhIG5ldyBlbnRyeSBpZiBub25lIGV4aXN0cy5cbiAgICAgIGRhdGEgPSBpZGF0YTtcbiAgICAgIGlmICghZGF0YSkge1xuICAgICAgICB2YXIgZW5kID0gdGhpcy5fcmVjZWl2ZWRbaWRdO1xuICAgICAgICBpZiAoZW5kID09PSB0cnVlKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgZGF0YSA9IHtcbiAgICAgICAgICBhY2s6IFsnYWNrJywgaWQsIDBdLFxuICAgICAgICAgIGNodW5rczogW11cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5faW5jb21pbmdbaWRdID0gZGF0YTtcbiAgICAgIH1cblxuICAgICAgdmFyIG4gPSBtc2dbMl07XG4gICAgICB2YXIgY2h1bmsgPSBtc2dbM107XG4gICAgICBkYXRhLmNodW5rc1tuXSA9IG5ldyBVaW50OEFycmF5KGNodW5rKTtcblxuICAgICAgLy8gSWYgd2UgZ2V0IHRoZSBjaHVuayB3ZSdyZSBsb29raW5nIGZvciwgQUNLIGZvciBuZXh0IG1pc3NpbmcuXG4gICAgICAvLyBPdGhlcndpc2UsIEFDSyB0aGUgc2FtZSBOIGFnYWluLlxuICAgICAgaWYgKG4gPT09IGRhdGEuYWNrWzJdKSB7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZU5leHRBY2soaWQpO1xuICAgICAgfVxuICAgICAgdGhpcy5fYWNrKGlkKTtcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBTaG91bGRuJ3QgaGFwcGVuLCBidXQgd291bGQgbWFrZSBzZW5zZSBmb3IgbWVzc2FnZSB0byBqdXN0IGdvXG4gICAgICAvLyB0aHJvdWdoIGFzIGlzLlxuICAgICAgdGhpcy5faGFuZGxlU2VuZChtc2cpO1xuICAgICAgYnJlYWs7XG4gIH1cbn07XG5cbi8vIENodW5rcyBCTCBpbnRvIHNtYWxsZXIgbWVzc2FnZXMuXG5SZWxpYWJsZS5wcm90b3R5cGUuX2NodW5rID0gZnVuY3Rpb24oYmwpIHtcbiAgdmFyIGNodW5rcyA9IFtdO1xuICB2YXIgc2l6ZSA9IGJsLnNpemU7XG4gIHZhciBzdGFydCA9IDA7XG4gIHdoaWxlIChzdGFydCA8IHNpemUpIHtcbiAgICB2YXIgZW5kID0gTWF0aC5taW4oc2l6ZSwgc3RhcnQgKyB0aGlzLl9tdHUpO1xuICAgIHZhciBiID0gYmwuc2xpY2Uoc3RhcnQsIGVuZCk7XG4gICAgdmFyIGNodW5rID0ge1xuICAgICAgcGF5bG9hZDogYlxuICAgIH1cbiAgICBjaHVua3MucHVzaChjaHVuayk7XG4gICAgc3RhcnQgPSBlbmQ7XG4gIH1cbiAgdXRpbC5sb2coJ0NyZWF0ZWQnLCBjaHVua3MubGVuZ3RoLCAnY2h1bmtzLicpO1xuICByZXR1cm4gY2h1bmtzO1xufTtcblxuLy8gU2VuZHMgQUNLIE4sIGV4cGVjdGluZyBOdGggYmxvYiBjaHVuayBmb3IgbWVzc2FnZSBJRC5cblJlbGlhYmxlLnByb3RvdHlwZS5fYWNrID0gZnVuY3Rpb24oaWQpIHtcbiAgdmFyIGFjayA9IHRoaXMuX2luY29taW5nW2lkXS5hY2s7XG5cbiAgLy8gaWYgYWNrIGlzIHRoZSBlbmQgdmFsdWUsIHRoZW4gY2FsbCBfY29tcGxldGUuXG4gIGlmICh0aGlzLl9yZWNlaXZlZFtpZF0gPT09IGFja1syXSkge1xuICAgIHRoaXMuX2NvbXBsZXRlKGlkKTtcbiAgICB0aGlzLl9yZWNlaXZlZFtpZF0gPSB0cnVlO1xuICB9XG5cbiAgdGhpcy5faGFuZGxlU2VuZChhY2spO1xufTtcblxuLy8gQ2FsY3VsYXRlcyB0aGUgbmV4dCBBQ0sgbnVtYmVyLCBnaXZlbiBjaHVua3MuXG5SZWxpYWJsZS5wcm90b3R5cGUuX2NhbGN1bGF0ZU5leHRBY2sgPSBmdW5jdGlvbihpZCkge1xuICB2YXIgZGF0YSA9IHRoaXMuX2luY29taW5nW2lkXTtcbiAgdmFyIGNodW5rcyA9IGRhdGEuY2h1bmtzO1xuICBmb3IgKHZhciBpID0gMCwgaWkgPSBjaHVua3MubGVuZ3RoOyBpIDwgaWk7IGkgKz0gMSkge1xuICAgIC8vIFRoaXMgY2h1bmsgaXMgbWlzc2luZyEhISBCZXR0ZXIgQUNLIGZvciBpdC5cbiAgICBpZiAoY2h1bmtzW2ldID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGRhdGEuYWNrWzJdID0gaTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbiAgZGF0YS5hY2tbMl0gPSBjaHVua3MubGVuZ3RoO1xufTtcblxuLy8gU2VuZHMgdGhlIG5leHQgd2luZG93IG9mIGNodW5rcy5cblJlbGlhYmxlLnByb3RvdHlwZS5fc2VuZFdpbmRvd2VkQ2h1bmtzID0gZnVuY3Rpb24oaWQpIHtcbiAgdXRpbC5sb2coJ3NlbmRXaW5kb3dlZENodW5rcyBmb3I6ICcsIGlkKTtcbiAgdmFyIGRhdGEgPSB0aGlzLl9vdXRnb2luZ1tpZF07XG4gIHZhciBjaCA9IGRhdGEuY2h1bmtzO1xuICB2YXIgY2h1bmtzID0gW107XG4gIHZhciBsaW1pdCA9IE1hdGgubWluKGRhdGEuYWNrICsgdGhpcy5fd2luZG93LCBjaC5sZW5ndGgpO1xuICBmb3IgKHZhciBpID0gZGF0YS5hY2s7IGkgPCBsaW1pdDsgaSArPSAxKSB7XG4gICAgaWYgKCFjaFtpXS5zZW50IHx8IGkgPT09IGRhdGEuYWNrKSB7XG4gICAgICBjaFtpXS5zZW50ID0gdHJ1ZTtcbiAgICAgIGNodW5rcy5wdXNoKFsnY2h1bmsnLCBpZCwgaSwgY2hbaV0ucGF5bG9hZF0pO1xuICAgIH1cbiAgfVxuICBpZiAoZGF0YS5hY2sgKyB0aGlzLl93aW5kb3cgPj0gY2gubGVuZ3RoKSB7XG4gICAgY2h1bmtzLnB1c2goWydlbmQnLCBpZCwgY2gubGVuZ3RoXSlcbiAgfVxuICBjaHVua3MuX211bHRpcGxlID0gdHJ1ZTtcbiAgdGhpcy5faGFuZGxlU2VuZChjaHVua3MpO1xufTtcblxuLy8gUHV0cyB0b2dldGhlciBhIG1lc3NhZ2UgZnJvbSBjaHVua3MuXG5SZWxpYWJsZS5wcm90b3R5cGUuX2NvbXBsZXRlID0gZnVuY3Rpb24oaWQpIHtcbiAgdXRpbC5sb2coJ0NvbXBsZXRlZCBjYWxsZWQgZm9yJywgaWQpO1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBjaHVua3MgPSB0aGlzLl9pbmNvbWluZ1tpZF0uY2h1bmtzO1xuICB2YXIgYmwgPSBuZXcgQmxvYihjaHVua3MpO1xuICB1dGlsLmJsb2JUb0FycmF5QnVmZmVyKGJsLCBmdW5jdGlvbihhYikge1xuICAgIHNlbGYub25tZXNzYWdlKHV0aWwudW5wYWNrKGFiKSk7XG4gIH0pO1xuICBkZWxldGUgdGhpcy5faW5jb21pbmdbaWRdO1xufTtcblxuLy8gVXBzIGJhbmR3aWR0aCBsaW1pdCBvbiBTRFAuIE1lYW50IHRvIGJlIGNhbGxlZCBkdXJpbmcgb2ZmZXIvYW5zd2VyLlxuUmVsaWFibGUuaGlnaGVyQmFuZHdpZHRoU0RQID0gZnVuY3Rpb24oc2RwKSB7XG4gIC8vIEFTIHN0YW5kcyBmb3IgQXBwbGljYXRpb24tU3BlY2lmaWMgTWF4aW11bS5cbiAgLy8gQmFuZHdpZHRoIG51bWJlciBpcyBpbiBraWxvYml0cyAvIHNlYy5cbiAgLy8gU2VlIFJGQyBmb3IgbW9yZSBpbmZvOiBodHRwOi8vd3d3LmlldGYub3JnL3JmYy9yZmMyMzI3LnR4dFxuXG4gIC8vIENocm9tZSAzMSsgZG9lc24ndCB3YW50IHVzIG11bmdpbmcgdGhlIFNEUCwgc28gd2UnbGwgbGV0IHRoZW0gaGF2ZSB0aGVpclxuICAvLyB3YXkuXG4gIHZhciB2ZXJzaW9uID0gbmF2aWdhdG9yLmFwcFZlcnNpb24ubWF0Y2goL0Nocm9tZVxcLyguKj8pIC8pO1xuICBpZiAodmVyc2lvbikge1xuICAgIHZlcnNpb24gPSBwYXJzZUludCh2ZXJzaW9uWzFdLnNwbGl0KCcuJykuc2hpZnQoKSk7XG4gICAgaWYgKHZlcnNpb24gPCAzMSkge1xuICAgICAgdmFyIHBhcnRzID0gc2RwLnNwbGl0KCdiPUFTOjMwJyk7XG4gICAgICB2YXIgcmVwbGFjZSA9ICdiPUFTOjEwMjQwMCc7IC8vIDEwMCBNYnBzXG4gICAgICBpZiAocGFydHMubGVuZ3RoID4gMSkge1xuICAgICAgICByZXR1cm4gcGFydHNbMF0gKyByZXBsYWNlICsgcGFydHNbMV07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHNkcDtcbn07XG5cbi8vIE92ZXJ3cml0dGVuLCB0eXBpY2FsbHkuXG5SZWxpYWJsZS5wcm90b3R5cGUub25tZXNzYWdlID0gZnVuY3Rpb24obXNnKSB7fTtcblxubW9kdWxlLmV4cG9ydHMuUmVsaWFibGUgPSBSZWxpYWJsZTtcbiIsInZhciBCaW5hcnlQYWNrID0gcmVxdWlyZSgnanMtYmluYXJ5cGFjaycpO1xuXG52YXIgdXRpbCA9IHtcbiAgZGVidWc6IGZhbHNlLFxuICBcbiAgaW5oZXJpdHM6IGZ1bmN0aW9uKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yO1xuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgZXh0ZW5kOiBmdW5jdGlvbihkZXN0LCBzb3VyY2UpIHtcbiAgICBmb3IodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgIGlmKHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIGRlc3Rba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVzdDtcbiAgfSxcbiAgcGFjazogQmluYXJ5UGFjay5wYWNrLFxuICB1bnBhY2s6IEJpbmFyeVBhY2sudW5wYWNrLFxuICBcbiAgbG9nOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHV0aWwuZGVidWcpIHtcbiAgICAgIHZhciBjb3B5ID0gW107XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb3B5W2ldID0gYXJndW1lbnRzW2ldO1xuICAgICAgfVxuICAgICAgY29weS51bnNoaWZ0KCdSZWxpYWJsZTogJyk7XG4gICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBjb3B5KTtcbiAgICB9XG4gIH0sXG5cbiAgc2V0WmVyb1RpbWVvdXQ6IChmdW5jdGlvbihnbG9iYWwpIHtcbiAgICB2YXIgdGltZW91dHMgPSBbXTtcbiAgICB2YXIgbWVzc2FnZU5hbWUgPSAnemVyby10aW1lb3V0LW1lc3NhZ2UnO1xuXG4gICAgLy8gTGlrZSBzZXRUaW1lb3V0LCBidXQgb25seSB0YWtlcyBhIGZ1bmN0aW9uIGFyZ3VtZW50Llx0IFRoZXJlJ3NcbiAgICAvLyBubyB0aW1lIGFyZ3VtZW50IChhbHdheXMgemVybykgYW5kIG5vIGFyZ3VtZW50cyAoeW91IGhhdmUgdG9cbiAgICAvLyB1c2UgYSBjbG9zdXJlKS5cbiAgICBmdW5jdGlvbiBzZXRaZXJvVGltZW91dFBvc3RNZXNzYWdlKGZuKSB7XG4gICAgICB0aW1lb3V0cy5wdXNoKGZuKTtcbiAgICAgIGdsb2JhbC5wb3N0TWVzc2FnZShtZXNzYWdlTmFtZSwgJyonKTtcbiAgICB9XHRcdFxuXG4gICAgZnVuY3Rpb24gaGFuZGxlTWVzc2FnZShldmVudCkge1xuICAgICAgaWYgKGV2ZW50LnNvdXJjZSA9PSBnbG9iYWwgJiYgZXZlbnQuZGF0YSA9PSBtZXNzYWdlTmFtZSkge1xuICAgICAgICBpZiAoZXZlbnQuc3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRpbWVvdXRzLmxlbmd0aCkge1xuICAgICAgICAgIHRpbWVvdXRzLnNoaWZ0KCkoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAoZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgIGdsb2JhbC5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgaGFuZGxlTWVzc2FnZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChnbG9iYWwuYXR0YWNoRXZlbnQpIHtcbiAgICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25tZXNzYWdlJywgaGFuZGxlTWVzc2FnZSk7XG4gICAgfVxuICAgIHJldHVybiBzZXRaZXJvVGltZW91dFBvc3RNZXNzYWdlO1xuICB9KHRoaXMpKSxcbiAgXG4gIGJsb2JUb0FycmF5QnVmZmVyOiBmdW5jdGlvbihibG9iLCBjYil7XG4gICAgdmFyIGZyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICBmci5vbmxvYWQgPSBmdW5jdGlvbihldnQpIHtcbiAgICAgIGNiKGV2dC50YXJnZXQucmVzdWx0KTtcbiAgICB9O1xuICAgIGZyLnJlYWRBc0FycmF5QnVmZmVyKGJsb2IpO1xuICB9LFxuICBibG9iVG9CaW5hcnlTdHJpbmc6IGZ1bmN0aW9uKGJsb2IsIGNiKXtcbiAgICB2YXIgZnIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgIGZyLm9ubG9hZCA9IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgY2IoZXZ0LnRhcmdldC5yZXN1bHQpO1xuICAgIH07XG4gICAgZnIucmVhZEFzQmluYXJ5U3RyaW5nKGJsb2IpO1xuICB9LFxuICBiaW5hcnlTdHJpbmdUb0FycmF5QnVmZmVyOiBmdW5jdGlvbihiaW5hcnkpIHtcbiAgICB2YXIgYnl0ZUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYmluYXJ5Lmxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBiaW5hcnkubGVuZ3RoOyBpKyspIHtcbiAgICAgIGJ5dGVBcnJheVtpXSA9IGJpbmFyeS5jaGFyQ29kZUF0KGkpICYgMHhmZjtcbiAgICB9XG4gICAgcmV0dXJuIGJ5dGVBcnJheS5idWZmZXI7XG4gIH0sXG4gIHJhbmRvbVRva2VuOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSB1dGlsO1xuIiwiLypqc2xpbnQgb25ldmFyOnRydWUsIHVuZGVmOnRydWUsIG5ld2NhcDp0cnVlLCByZWdleHA6dHJ1ZSwgYml0d2lzZTp0cnVlLCBtYXhlcnI6NTAsIGluZGVudDo0LCB3aGl0ZTpmYWxzZSwgbm9tZW46ZmFsc2UsIHBsdXNwbHVzOmZhbHNlICovXG4vKmdsb2JhbCBkZWZpbmU6ZmFsc2UsIHJlcXVpcmU6ZmFsc2UsIGV4cG9ydHM6ZmFsc2UsIG1vZHVsZTpmYWxzZSwgc2lnbmFsczpmYWxzZSAqL1xuXG4vKiogQGxpY2Vuc2VcbiAqIEpTIFNpZ25hbHMgPGh0dHA6Ly9taWxsZXJtZWRlaXJvcy5naXRodWIuY29tL2pzLXNpZ25hbHMvPlxuICogUmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlXG4gKiBBdXRob3I6IE1pbGxlciBNZWRlaXJvc1xuICogVmVyc2lvbjogMS4wLjAgLSBCdWlsZDogMjY4ICgyMDEyLzExLzI5IDA1OjQ4IFBNKVxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpe1xuXG4gICAgLy8gU2lnbmFsQmluZGluZyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiBPYmplY3QgdGhhdCByZXByZXNlbnRzIGEgYmluZGluZyBiZXR3ZWVuIGEgU2lnbmFsIGFuZCBhIGxpc3RlbmVyIGZ1bmN0aW9uLlxuICAgICAqIDxiciAvPi0gPHN0cm9uZz5UaGlzIGlzIGFuIGludGVybmFsIGNvbnN0cnVjdG9yIGFuZCBzaG91bGRuJ3QgYmUgY2FsbGVkIGJ5IHJlZ3VsYXIgdXNlcnMuPC9zdHJvbmc+XG4gICAgICogPGJyIC8+LSBpbnNwaXJlZCBieSBKb2EgRWJlcnQgQVMzIFNpZ25hbEJpbmRpbmcgYW5kIFJvYmVydCBQZW5uZXIncyBTbG90IGNsYXNzZXMuXG4gICAgICogQGF1dGhvciBNaWxsZXIgTWVkZWlyb3NcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKiBAaW50ZXJuYWxcbiAgICAgKiBAbmFtZSBTaWduYWxCaW5kaW5nXG4gICAgICogQHBhcmFtIHtTaWduYWx9IHNpZ25hbCBSZWZlcmVuY2UgdG8gU2lnbmFsIG9iamVjdCB0aGF0IGxpc3RlbmVyIGlzIGN1cnJlbnRseSBib3VuZCB0by5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpc09uY2UgSWYgYmluZGluZyBzaG91bGQgYmUgZXhlY3V0ZWQganVzdCBvbmNlLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XSBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbcHJpb3JpdHldIFRoZSBwcmlvcml0eSBsZXZlbCBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuIChkZWZhdWx0ID0gMCkuXG4gICAgICovXG4gICAgZnVuY3Rpb24gU2lnbmFsQmluZGluZyhzaWduYWwsIGxpc3RlbmVyLCBpc09uY2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSGFuZGxlciBmdW5jdGlvbiBib3VuZCB0byB0aGUgc2lnbmFsLlxuICAgICAgICAgKiBAdHlwZSBGdW5jdGlvblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbGlzdGVuZXIgPSBsaXN0ZW5lcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgYmluZGluZyBzaG91bGQgYmUgZXhlY3V0ZWQganVzdCBvbmNlLlxuICAgICAgICAgKiBAdHlwZSBib29sZWFuXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9pc09uY2UgPSBpc09uY2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnRleHQgb24gd2hpY2ggbGlzdGVuZXIgd2lsbCBiZSBleGVjdXRlZCAob2JqZWN0IHRoYXQgc2hvdWxkIHJlcHJlc2VudCB0aGUgYHRoaXNgIHZhcmlhYmxlIGluc2lkZSBsaXN0ZW5lciBmdW5jdGlvbikuXG4gICAgICAgICAqIEBtZW1iZXJPZiBTaWduYWxCaW5kaW5nLnByb3RvdHlwZVxuICAgICAgICAgKiBAbmFtZSBjb250ZXh0XG4gICAgICAgICAqIEB0eXBlIE9iamVjdHx1bmRlZmluZWR8bnVsbFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jb250ZXh0ID0gbGlzdGVuZXJDb250ZXh0O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWZlcmVuY2UgdG8gU2lnbmFsIG9iamVjdCB0aGF0IGxpc3RlbmVyIGlzIGN1cnJlbnRseSBib3VuZCB0by5cbiAgICAgICAgICogQHR5cGUgU2lnbmFsXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zaWduYWwgPSBzaWduYWw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIExpc3RlbmVyIHByaW9yaXR5XG4gICAgICAgICAqIEB0eXBlIE51bWJlclxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcHJpb3JpdHkgPSBwcmlvcml0eSB8fCAwO1xuICAgIH1cblxuICAgIFNpZ25hbEJpbmRpbmcucHJvdG90eXBlID0ge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBiaW5kaW5nIGlzIGFjdGl2ZSBhbmQgc2hvdWxkIGJlIGV4ZWN1dGVkLlxuICAgICAgICAgKiBAdHlwZSBib29sZWFuXG4gICAgICAgICAqL1xuICAgICAgICBhY3RpdmUgOiB0cnVlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWZhdWx0IHBhcmFtZXRlcnMgcGFzc2VkIHRvIGxpc3RlbmVyIGR1cmluZyBgU2lnbmFsLmRpc3BhdGNoYCBhbmQgYFNpZ25hbEJpbmRpbmcuZXhlY3V0ZWAuIChjdXJyaWVkIHBhcmFtZXRlcnMpXG4gICAgICAgICAqIEB0eXBlIEFycmF5fG51bGxcbiAgICAgICAgICovXG4gICAgICAgIHBhcmFtcyA6IG51bGwsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENhbGwgbGlzdGVuZXIgcGFzc2luZyBhcmJpdHJhcnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogPHA+SWYgYmluZGluZyB3YXMgYWRkZWQgdXNpbmcgYFNpZ25hbC5hZGRPbmNlKClgIGl0IHdpbGwgYmUgYXV0b21hdGljYWxseSByZW1vdmVkIGZyb20gc2lnbmFsIGRpc3BhdGNoIHF1ZXVlLCB0aGlzIG1ldGhvZCBpcyB1c2VkIGludGVybmFsbHkgZm9yIHRoZSBzaWduYWwgZGlzcGF0Y2guPC9wPlxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBbcGFyYW1zQXJyXSBBcnJheSBvZiBwYXJhbWV0ZXJzIHRoYXQgc2hvdWxkIGJlIHBhc3NlZCB0byB0aGUgbGlzdGVuZXJcbiAgICAgICAgICogQHJldHVybiB7Kn0gVmFsdWUgcmV0dXJuZWQgYnkgdGhlIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgZXhlY3V0ZSA6IGZ1bmN0aW9uIChwYXJhbXNBcnIpIHtcbiAgICAgICAgICAgIHZhciBoYW5kbGVyUmV0dXJuLCBwYXJhbXM7XG4gICAgICAgICAgICBpZiAodGhpcy5hY3RpdmUgJiYgISF0aGlzLl9saXN0ZW5lcikge1xuICAgICAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMucGFyYW1zPyB0aGlzLnBhcmFtcy5jb25jYXQocGFyYW1zQXJyKSA6IHBhcmFtc0FycjtcbiAgICAgICAgICAgICAgICBoYW5kbGVyUmV0dXJuID0gdGhpcy5fbGlzdGVuZXIuYXBwbHkodGhpcy5jb250ZXh0LCBwYXJhbXMpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pc09uY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXRhY2goKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gaGFuZGxlclJldHVybjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGV0YWNoIGJpbmRpbmcgZnJvbSBzaWduYWwuXG4gICAgICAgICAqIC0gYWxpYXMgdG86IG15U2lnbmFsLnJlbW92ZShteUJpbmRpbmcuZ2V0TGlzdGVuZXIoKSk7XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufG51bGx9IEhhbmRsZXIgZnVuY3Rpb24gYm91bmQgdG8gdGhlIHNpZ25hbCBvciBgbnVsbGAgaWYgYmluZGluZyB3YXMgcHJldmlvdXNseSBkZXRhY2hlZC5cbiAgICAgICAgICovXG4gICAgICAgIGRldGFjaCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmlzQm91bmQoKT8gdGhpcy5fc2lnbmFsLnJlbW92ZSh0aGlzLl9saXN0ZW5lciwgdGhpcy5jb250ZXh0KSA6IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge0Jvb2xlYW59IGB0cnVlYCBpZiBiaW5kaW5nIGlzIHN0aWxsIGJvdW5kIHRvIHRoZSBzaWduYWwgYW5kIGhhdmUgYSBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGlzQm91bmQgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gKCEhdGhpcy5fc2lnbmFsICYmICEhdGhpcy5fbGlzdGVuZXIpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufSBJZiBTaWduYWxCaW5kaW5nIHdpbGwgb25seSBiZSBleGVjdXRlZCBvbmNlLlxuICAgICAgICAgKi9cbiAgICAgICAgaXNPbmNlIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2lzT25jZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259IEhhbmRsZXIgZnVuY3Rpb24gYm91bmQgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICovXG4gICAgICAgIGdldExpc3RlbmVyIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2xpc3RlbmVyO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWx9IFNpZ25hbCB0aGF0IGxpc3RlbmVyIGlzIGN1cnJlbnRseSBib3VuZCB0by5cbiAgICAgICAgICovXG4gICAgICAgIGdldFNpZ25hbCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zaWduYWw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERlbGV0ZSBpbnN0YW5jZSBwcm9wZXJ0aWVzXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfZGVzdHJveSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9zaWduYWw7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGlzdGVuZXI7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5jb250ZXh0O1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IFN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgb2JqZWN0LlxuICAgICAgICAgKi9cbiAgICAgICAgdG9TdHJpbmcgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJ1tTaWduYWxCaW5kaW5nIGlzT25jZTonICsgdGhpcy5faXNPbmNlICsnLCBpc0JvdW5kOicrIHRoaXMuaXNCb3VuZCgpICsnLCBhY3RpdmU6JyArIHRoaXMuYWN0aXZlICsgJ10nO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG5cbi8qZ2xvYmFsIFNpZ25hbEJpbmRpbmc6ZmFsc2UqL1xuXG4gICAgLy8gU2lnbmFsIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBmdW5jdGlvbiB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCBmbk5hbWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCAnbGlzdGVuZXIgaXMgYSByZXF1aXJlZCBwYXJhbSBvZiB7Zm59KCkgYW5kIHNob3VsZCBiZSBhIEZ1bmN0aW9uLicucmVwbGFjZSgne2ZufScsIGZuTmFtZSkgKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEN1c3RvbSBldmVudCBicm9hZGNhc3RlclxuICAgICAqIDxiciAvPi0gaW5zcGlyZWQgYnkgUm9iZXJ0IFBlbm5lcidzIEFTMyBTaWduYWxzLlxuICAgICAqIEBuYW1lIFNpZ25hbFxuICAgICAqIEBhdXRob3IgTWlsbGVyIE1lZGVpcm9zXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgZnVuY3Rpb24gU2lnbmFsKCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUgQXJyYXkuPFNpZ25hbEJpbmRpbmc+XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9iaW5kaW5ncyA9IFtdO1xuICAgICAgICB0aGlzLl9wcmV2UGFyYW1zID0gbnVsbDtcblxuICAgICAgICAvLyBlbmZvcmNlIGRpc3BhdGNoIHRvIGF3YXlzIHdvcmsgb24gc2FtZSBjb250ZXh0ICgjNDcpXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdGhpcy5kaXNwYXRjaCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBTaWduYWwucHJvdG90eXBlLmRpc3BhdGNoLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgU2lnbmFsLnByb3RvdHlwZSA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2lnbmFscyBWZXJzaW9uIE51bWJlclxuICAgICAgICAgKiBAdHlwZSBTdHJpbmdcbiAgICAgICAgICogQGNvbnN0XG4gICAgICAgICAqL1xuICAgICAgICBWRVJTSU9OIDogJzEuMC4wJyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgU2lnbmFsIHNob3VsZCBrZWVwIHJlY29yZCBvZiBwcmV2aW91c2x5IGRpc3BhdGNoZWQgcGFyYW1ldGVycyBhbmRcbiAgICAgICAgICogYXV0b21hdGljYWxseSBleGVjdXRlIGxpc3RlbmVyIGR1cmluZyBgYWRkKClgL2BhZGRPbmNlKClgIGlmIFNpZ25hbCB3YXNcbiAgICAgICAgICogYWxyZWFkeSBkaXNwYXRjaGVkIGJlZm9yZS5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKi9cbiAgICAgICAgbWVtb3JpemUgOiBmYWxzZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3Nob3VsZFByb3BhZ2F0ZSA6IHRydWUsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIFNpZ25hbCBpcyBhY3RpdmUgYW5kIHNob3VsZCBicm9hZGNhc3QgZXZlbnRzLlxuICAgICAgICAgKiA8cD48c3Ryb25nPklNUE9SVEFOVDo8L3N0cm9uZz4gU2V0dGluZyB0aGlzIHByb3BlcnR5IGR1cmluZyBhIGRpc3BhdGNoIHdpbGwgb25seSBhZmZlY3QgdGhlIG5leHQgZGlzcGF0Y2gsIGlmIHlvdSB3YW50IHRvIHN0b3AgdGhlIHByb3BhZ2F0aW9uIG9mIGEgc2lnbmFsIHVzZSBgaGFsdCgpYCBpbnN0ZWFkLjwvcD5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKi9cbiAgICAgICAgYWN0aXZlIDogdHJ1ZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcbiAgICAgICAgICogQHBhcmFtIHtib29sZWFufSBpc09uY2VcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtsaXN0ZW5lckNvbnRleHRdXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbcHJpb3JpdHldXG4gICAgICAgICAqIEByZXR1cm4ge1NpZ25hbEJpbmRpbmd9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfcmVnaXN0ZXJMaXN0ZW5lciA6IGZ1bmN0aW9uIChsaXN0ZW5lciwgaXNPbmNlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG5cbiAgICAgICAgICAgIHZhciBwcmV2SW5kZXggPSB0aGlzLl9pbmRleE9mTGlzdGVuZXIobGlzdGVuZXIsIGxpc3RlbmVyQ29udGV4dCksXG4gICAgICAgICAgICAgICAgYmluZGluZztcblxuICAgICAgICAgICAgaWYgKHByZXZJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBiaW5kaW5nID0gdGhpcy5fYmluZGluZ3NbcHJldkluZGV4XTtcbiAgICAgICAgICAgICAgICBpZiAoYmluZGluZy5pc09uY2UoKSAhPT0gaXNPbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IGNhbm5vdCBhZGQnKyAoaXNPbmNlPyAnJyA6ICdPbmNlJykgKycoKSB0aGVuIGFkZCcrICghaXNPbmNlPyAnJyA6ICdPbmNlJykgKycoKSB0aGUgc2FtZSBsaXN0ZW5lciB3aXRob3V0IHJlbW92aW5nIHRoZSByZWxhdGlvbnNoaXAgZmlyc3QuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBiaW5kaW5nID0gbmV3IFNpZ25hbEJpbmRpbmcodGhpcywgbGlzdGVuZXIsIGlzT25jZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkQmluZGluZyhiaW5kaW5nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYodGhpcy5tZW1vcml6ZSAmJiB0aGlzLl9wcmV2UGFyYW1zKXtcbiAgICAgICAgICAgICAgICBiaW5kaW5nLmV4ZWN1dGUodGhpcy5fcHJldlBhcmFtcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBiaW5kaW5nO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0ge1NpZ25hbEJpbmRpbmd9IGJpbmRpbmdcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9hZGRCaW5kaW5nIDogZnVuY3Rpb24gKGJpbmRpbmcpIHtcbiAgICAgICAgICAgIC8vc2ltcGxpZmllZCBpbnNlcnRpb24gc29ydFxuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGg7XG4gICAgICAgICAgICBkbyB7IC0tbjsgfSB3aGlsZSAodGhpcy5fYmluZGluZ3Nbbl0gJiYgYmluZGluZy5fcHJpb3JpdHkgPD0gdGhpcy5fYmluZGluZ3Nbbl0uX3ByaW9yaXR5KTtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLnNwbGljZShuICsgMSwgMCwgYmluZGluZyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9pbmRleE9mTGlzdGVuZXIgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHZhciBuID0gdGhpcy5fYmluZGluZ3MubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGN1cjtcbiAgICAgICAgICAgIHdoaWxlIChuLS0pIHtcbiAgICAgICAgICAgICAgICBjdXIgPSB0aGlzLl9iaW5kaW5nc1tuXTtcbiAgICAgICAgICAgICAgICBpZiAoY3VyLl9saXN0ZW5lciA9PT0gbGlzdGVuZXIgJiYgY3VyLmNvbnRleHQgPT09IGNvbnRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDaGVjayBpZiBsaXN0ZW5lciB3YXMgYXR0YWNoZWQgdG8gU2lnbmFsLlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbnRleHRdXG4gICAgICAgICAqIEByZXR1cm4ge2Jvb2xlYW59IGlmIFNpZ25hbCBoYXMgdGhlIHNwZWNpZmllZCBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGhhcyA6IGZ1bmN0aW9uIChsaXN0ZW5lciwgY29udGV4dCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2luZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lciwgY29udGV4dCkgIT09IC0xO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgYSBsaXN0ZW5lciB0byB0aGUgc2lnbmFsLlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBTaWduYWwgaGFuZGxlciBmdW5jdGlvbi5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtsaXN0ZW5lckNvbnRleHRdIENvbnRleHQgb24gd2hpY2ggbGlzdGVuZXIgd2lsbCBiZSBleGVjdXRlZCAob2JqZWN0IHRoYXQgc2hvdWxkIHJlcHJlc2VudCB0aGUgYHRoaXNgIHZhcmlhYmxlIGluc2lkZSBsaXN0ZW5lciBmdW5jdGlvbikuXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbcHJpb3JpdHldIFRoZSBwcmlvcml0eSBsZXZlbCBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuIExpc3RlbmVycyB3aXRoIGhpZ2hlciBwcmlvcml0eSB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZSBsaXN0ZW5lcnMgd2l0aCBsb3dlciBwcmlvcml0eS4gTGlzdGVuZXJzIHdpdGggc2FtZSBwcmlvcml0eSBsZXZlbCB3aWxsIGJlIGV4ZWN1dGVkIGF0IHRoZSBzYW1lIG9yZGVyIGFzIHRoZXkgd2VyZSBhZGRlZC4gKGRlZmF1bHQgPSAwKVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfSBBbiBPYmplY3QgcmVwcmVzZW50aW5nIHRoZSBiaW5kaW5nIGJldHdlZW4gdGhlIFNpZ25hbCBhbmQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBhZGQgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpIHtcbiAgICAgICAgICAgIHZhbGlkYXRlTGlzdGVuZXIobGlzdGVuZXIsICdhZGQnKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWdpc3Rlckxpc3RlbmVyKGxpc3RlbmVyLCBmYWxzZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZCBsaXN0ZW5lciB0byB0aGUgc2lnbmFsIHRoYXQgc2hvdWxkIGJlIHJlbW92ZWQgYWZ0ZXIgZmlyc3QgZXhlY3V0aW9uICh3aWxsIGJlIGV4ZWN1dGVkIG9ubHkgb25jZSkuXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIFNpZ25hbCBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gW2xpc3RlbmVyQ29udGV4dF0gQ29udGV4dCBvbiB3aGljaCBsaXN0ZW5lciB3aWxsIGJlIGV4ZWN1dGVkIChvYmplY3QgdGhhdCBzaG91bGQgcmVwcmVzZW50IHRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIGxpc3RlbmVyIGZ1bmN0aW9uKS5cbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IFtwcmlvcml0eV0gVGhlIHByaW9yaXR5IGxldmVsIG9mIHRoZSBldmVudCBsaXN0ZW5lci4gTGlzdGVuZXJzIHdpdGggaGlnaGVyIHByaW9yaXR5IHdpbGwgYmUgZXhlY3V0ZWQgYmVmb3JlIGxpc3RlbmVycyB3aXRoIGxvd2VyIHByaW9yaXR5LiBMaXN0ZW5lcnMgd2l0aCBzYW1lIHByaW9yaXR5IGxldmVsIHdpbGwgYmUgZXhlY3V0ZWQgYXQgdGhlIHNhbWUgb3JkZXIgYXMgdGhleSB3ZXJlIGFkZGVkLiAoZGVmYXVsdCA9IDApXG4gICAgICAgICAqIEByZXR1cm4ge1NpZ25hbEJpbmRpbmd9IEFuIE9iamVjdCByZXByZXNlbnRpbmcgdGhlIGJpbmRpbmcgYmV0d2VlbiB0aGUgU2lnbmFsIGFuZCBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGFkZE9uY2UgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpIHtcbiAgICAgICAgICAgIHZhbGlkYXRlTGlzdGVuZXIobGlzdGVuZXIsICdhZGRPbmNlJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJMaXN0ZW5lcihsaXN0ZW5lciwgdHJ1ZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZSBhIHNpbmdsZSBsaXN0ZW5lciBmcm9tIHRoZSBkaXNwYXRjaCBxdWV1ZS5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgSGFuZGxlciBmdW5jdGlvbiB0aGF0IHNob3VsZCBiZSByZW1vdmVkLlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbnRleHRdIEV4ZWN1dGlvbiBjb250ZXh0IChzaW5jZSB5b3UgY2FuIGFkZCB0aGUgc2FtZSBoYW5kbGVyIG11bHRpcGxlIHRpbWVzIGlmIGV4ZWN1dGluZyBpbiBhIGRpZmZlcmVudCBjb250ZXh0KS5cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259IExpc3RlbmVyIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAgICAgICAqL1xuICAgICAgICByZW1vdmUgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHZhbGlkYXRlTGlzdGVuZXIobGlzdGVuZXIsICdyZW1vdmUnKTtcblxuICAgICAgICAgICAgdmFyIGkgPSB0aGlzLl9pbmRleE9mTGlzdGVuZXIobGlzdGVuZXIsIGNvbnRleHQpO1xuICAgICAgICAgICAgaWYgKGkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZGluZ3NbaV0uX2Rlc3Ryb3koKTsgLy9ubyByZWFzb24gdG8gYSBTaWduYWxCaW5kaW5nIGV4aXN0IGlmIGl0IGlzbid0IGF0dGFjaGVkIHRvIGEgc2lnbmFsXG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZGluZ3Muc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGxpc3RlbmVyO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgYWxsIGxpc3RlbmVycyBmcm9tIHRoZSBTaWduYWwuXG4gICAgICAgICAqL1xuICAgICAgICByZW1vdmVBbGwgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgbiA9IHRoaXMuX2JpbmRpbmdzLmxlbmd0aDtcbiAgICAgICAgICAgIHdoaWxlIChuLS0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kaW5nc1tuXS5fZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fYmluZGluZ3MubGVuZ3RoID0gMDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7bnVtYmVyfSBOdW1iZXIgb2YgbGlzdGVuZXJzIGF0dGFjaGVkIHRvIHRoZSBTaWduYWwuXG4gICAgICAgICAqL1xuICAgICAgICBnZXROdW1MaXN0ZW5lcnMgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fYmluZGluZ3MubGVuZ3RoO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9wIHByb3BhZ2F0aW9uIG9mIHRoZSBldmVudCwgYmxvY2tpbmcgdGhlIGRpc3BhdGNoIHRvIG5leHQgbGlzdGVuZXJzIG9uIHRoZSBxdWV1ZS5cbiAgICAgICAgICogPHA+PHN0cm9uZz5JTVBPUlRBTlQ6PC9zdHJvbmc+IHNob3VsZCBiZSBjYWxsZWQgb25seSBkdXJpbmcgc2lnbmFsIGRpc3BhdGNoLCBjYWxsaW5nIGl0IGJlZm9yZS9hZnRlciBkaXNwYXRjaCB3b24ndCBhZmZlY3Qgc2lnbmFsIGJyb2FkY2FzdC48L3A+XG4gICAgICAgICAqIEBzZWUgU2lnbmFsLnByb3RvdHlwZS5kaXNhYmxlXG4gICAgICAgICAqL1xuICAgICAgICBoYWx0IDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5fc2hvdWxkUHJvcGFnYXRlID0gZmFsc2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERpc3BhdGNoL0Jyb2FkY2FzdCBTaWduYWwgdG8gYWxsIGxpc3RlbmVycyBhZGRlZCB0byB0aGUgcXVldWUuXG4gICAgICAgICAqIEBwYXJhbSB7Li4uKn0gW3BhcmFtc10gUGFyYW1ldGVycyB0aGF0IHNob3VsZCBiZSBwYXNzZWQgdG8gZWFjaCBoYW5kbGVyLlxuICAgICAgICAgKi9cbiAgICAgICAgZGlzcGF0Y2ggOiBmdW5jdGlvbiAocGFyYW1zKSB7XG4gICAgICAgICAgICBpZiAoISB0aGlzLmFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHBhcmFtc0FyciA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyksXG4gICAgICAgICAgICAgICAgbiA9IHRoaXMuX2JpbmRpbmdzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBiaW5kaW5ncztcblxuICAgICAgICAgICAgaWYgKHRoaXMubWVtb3JpemUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcmV2UGFyYW1zID0gcGFyYW1zQXJyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoISBuKSB7XG4gICAgICAgICAgICAgICAgLy9zaG91bGQgY29tZSBhZnRlciBtZW1vcml6ZVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYmluZGluZ3MgPSB0aGlzLl9iaW5kaW5ncy5zbGljZSgpOyAvL2Nsb25lIGFycmF5IGluIGNhc2UgYWRkL3JlbW92ZSBpdGVtcyBkdXJpbmcgZGlzcGF0Y2hcbiAgICAgICAgICAgIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSA9IHRydWU7IC8vaW4gY2FzZSBgaGFsdGAgd2FzIGNhbGxlZCBiZWZvcmUgZGlzcGF0Y2ggb3IgZHVyaW5nIHRoZSBwcmV2aW91cyBkaXNwYXRjaC5cblxuICAgICAgICAgICAgLy9leGVjdXRlIGFsbCBjYWxsYmFja3MgdW50aWwgZW5kIG9mIHRoZSBsaXN0IG9yIHVudGlsIGEgY2FsbGJhY2sgcmV0dXJucyBgZmFsc2VgIG9yIHN0b3BzIHByb3BhZ2F0aW9uXG4gICAgICAgICAgICAvL3JldmVyc2UgbG9vcCBzaW5jZSBsaXN0ZW5lcnMgd2l0aCBoaWdoZXIgcHJpb3JpdHkgd2lsbCBiZSBhZGRlZCBhdCB0aGUgZW5kIG9mIHRoZSBsaXN0XG4gICAgICAgICAgICBkbyB7IG4tLTsgfSB3aGlsZSAoYmluZGluZ3Nbbl0gJiYgdGhpcy5fc2hvdWxkUHJvcGFnYXRlICYmIGJpbmRpbmdzW25dLmV4ZWN1dGUocGFyYW1zQXJyKSAhPT0gZmFsc2UpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGb3JnZXQgbWVtb3JpemVkIGFyZ3VtZW50cy5cbiAgICAgICAgICogQHNlZSBTaWduYWwubWVtb3JpemVcbiAgICAgICAgICovXG4gICAgICAgIGZvcmdldCA6IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB0aGlzLl9wcmV2UGFyYW1zID0gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlIGFsbCBiaW5kaW5ncyBmcm9tIHNpZ25hbCBhbmQgZGVzdHJveSBhbnkgcmVmZXJlbmNlIHRvIGV4dGVybmFsIG9iamVjdHMgKGRlc3Ryb3kgU2lnbmFsIG9iamVjdCkuXG4gICAgICAgICAqIDxwPjxzdHJvbmc+SU1QT1JUQU5UOjwvc3Ryb25nPiBjYWxsaW5nIGFueSBtZXRob2Qgb24gdGhlIHNpZ25hbCBpbnN0YW5jZSBhZnRlciBjYWxsaW5nIGRpc3Bvc2Ugd2lsbCB0aHJvdyBlcnJvcnMuPC9wPlxuICAgICAgICAgKi9cbiAgICAgICAgZGlzcG9zZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQWxsKCk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fYmluZGluZ3M7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fcHJldlBhcmFtcztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9iamVjdC5cbiAgICAgICAgICovXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdbU2lnbmFsIGFjdGl2ZTonKyB0aGlzLmFjdGl2ZSArJyBudW1MaXN0ZW5lcnM6JysgdGhpcy5nZXROdW1MaXN0ZW5lcnMoKSArJ10nO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG5cbiAgICAvLyBOYW1lc3BhY2UgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqIFNpZ25hbHMgbmFtZXNwYWNlXG4gICAgICogQG5hbWVzcGFjZVxuICAgICAqIEBuYW1lIHNpZ25hbHNcbiAgICAgKi9cbiAgICB2YXIgc2lnbmFscyA9IFNpZ25hbDtcblxuICAgIC8qKlxuICAgICAqIEN1c3RvbSBldmVudCBicm9hZGNhc3RlclxuICAgICAqIEBzZWUgU2lnbmFsXG4gICAgICovXG4gICAgLy8gYWxpYXMgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IChzZWUgI2doLTQ0KVxuICAgIHNpZ25hbHMuU2lnbmFsID0gU2lnbmFsO1xuXG5cblxuICAgIC8vZXhwb3J0cyB0byBtdWx0aXBsZSBlbnZpcm9ubWVudHNcbiAgICBpZih0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpeyAvL0FNRFxuICAgICAgICBkZWZpbmUoZnVuY3Rpb24gKCkgeyByZXR1cm4gc2lnbmFsczsgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cyl7IC8vbm9kZVxuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IHNpZ25hbHM7XG4gICAgfSBlbHNlIHsgLy9icm93c2VyXG4gICAgICAgIC8vdXNlIHN0cmluZyBiZWNhdXNlIG9mIEdvb2dsZSBjbG9zdXJlIGNvbXBpbGVyIEFEVkFOQ0VEX01PREVcbiAgICAgICAgLypqc2xpbnQgc3ViOnRydWUgKi9cbiAgICAgICAgZ2xvYmFsWydzaWduYWxzJ10gPSBzaWduYWxzO1xuICAgIH1cblxufSh0aGlzKSk7XG4iLCJ2YXIgaW8gPSByZXF1aXJlKCcuL3NvY2tldC5pby5qcycpO1xudmFyIFBlZXIgPSByZXF1aXJlKCdwZWVyanMnKTtcbnZhciBfICA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcbnZhciBzaWduYWxzID0gcmVxdWlyZSgnc2lnbmFscycpO1xudmFyIExvYmJ5ID0gZnVuY3Rpb24od3NfdXJsLG9wdGlvbnMpe1xuICAgIHRoaXMud3NfdXJsID0gd3NfdXJsO1xuICAgIHRoaXMuX29wdGlvbnMgPSBfLmV4dGVuZCh7XG4gICAgICAgIGxvYmJ5UGF0aDonL2xvYmJ5JyxcbiAgICAgICAgcGVlcmpzUGF0aDonL3BlZXJqcydcbiAgICB9LG9wdGlvbnMpO1xufTtcbkxvYmJ5LnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oKXtcbiAgICBjb25zb2xlLmxvZygnY29ubmVjdGluZycpO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlPT57XG4gICAgICAgIHRoaXMuc29ja2V0ID0gaW8odGhpcy53c191cmwse3BhdGg6dGhpcy5fb3B0aW9ucy5sb2JieVBhdGh9KTtcbiAgICAgICAgdGhpcy5zb2NrZXQub24oJ2Nvbm5lY3QnLCgpPT57cmVzb2x2ZSh0aGlzLnNvY2tldCl9KTtcbiAgICB9KVxufTtcbkxvYmJ5LnByb3RvdHlwZS5nZXRSb29tcyA9IGZ1bmN0aW9uKCl7XG4gICAgdGhpcy5zb2NrZXQuZW1pdCgncm9vbXMnLG51bGwsKHJvb21zKT0+e30pXG59O1xuTG9iYnkucHJvdG90eXBlLnF1aWNrRmluZCA9IGZ1bmN0aW9uKCl7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlPT57XG4gICAgICAgIHNlbGYuc29ja2V0LmVtaXQoJ3F1aWNrLWZpbmQnLG51bGwscm9vbT0+e3Jlc29sdmUocm9vbSl9KTtcbiAgICB9KVxufVxuXG5Mb2JieS5wcm90b3R5cGUucXVpY2tKb2luID0gZnVuY3Rpb24oKXtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmU9PntcbiAgICAgICAgc2VsZi5xdWlja0ZpbmQoKS50aGVuKF9yb29tID0+e1xuICAgICAgICAgICAgdmFyIHJvb20gPSBuZXcgX1Jvb20oc2VsZixzZWxmLl9vcHRpb25zKVxuICAgICAgICAgICAgcm9vbS5qb2luKF9yb29tLmlkKTtcbiAgICAgICAgICAgIHJlc29sdmUocm9vbSk7XG4gICAgICAgIH0pO1xuICAgIH0pXG59O1xuTG9iYnkucHJvdG90eXBlLmpvaW5Sb29tID0gZnVuY3Rpb24ocm9vbUlkKXtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZT0+e1xuICAgICAgICB2YXIgciA9IG5ldyBfUm9vbSh0aGlzLHRoaXMuX29wdGlvbnMpO1xuICAgICAgICByLmpvaW4ocm9vbUlkKS50aGVuKGQ9PnJlc29sdmUocikpO1xuICAgIH0pXG59O1xuTG9iYnkucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpe1xuICAgIHRoaXMuc29ja2V0LmRpc2Nvbm5lY3QoKTtcbn07XG52YXIgX1Jvb20gPSBmdW5jdGlvbihsb2JieSxvcHRpb25zKXtcbiAgICB0aGlzLl9vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmxvYmJ5ID0gbG9iYnk7XG4gICAgdGhpcy5zb2NrZXQgPSB0aGlzLmxvYmJ5LnNvY2tldDtcbiAgICB0aGlzLnBlZXIgPSBudWxsO1xuICAgIHRoaXMuc3RhcnRpbmcgPSB7fTtcbiAgICB0aGlzLmdhbWUgPSBudWxsO1xuXG4gICAgdGhpcy5zb2NrZXQub24oJ2Rpc2Nvbm5lY3QnLCBmdW5jdGlvbiAoKXtjb25zb2xlLmxvZygnZGlzY29ubmVjdGVkJyl9KTtcbiAgICB0aGlzLnNvY2tldC5vbignY29ubmVjdC10bycsdGhpcy5jb25uZWN0VG8uYmluZCh0aGlzKSk7XG4gICAgdGhpcy5zb2NrZXQub24oJ3NldC1ob3N0Jyx0aGlzLnNldEhvc3QuYmluZCh0aGlzKSk7XG4gICAgdGhpcy5zb2NrZXQub24oJ2Nhbi1zdGFydCcsdGhpcy5zdGFydC5iaW5kKHRoaXMpKTtcblxuICAgIHRoaXMub25Ib3N0U2V0ID0gbmV3IHNpZ25hbHMuU2lnbmFsKCk7XG4gICAgdGhpcy5vblBlZXJDb25uZWN0ZWQgPSBuZXcgc2lnbmFscy5TaWduYWwoKTtcbiAgICB0aGlzLm9uUGVlckRpc2Nvbm5lY3RlZCA9IG5ldyBzaWduYWxzLlNpZ25hbCgpO1xuICAgIHRoaXMub25EYXRhUmVjZWl2ZWQgPSBuZXcgc2lnbmFscy5TaWduYWwoKTtcbn07XG5fUm9vbS5wcm90b3R5cGUuam9pbiA9IGZ1bmN0aW9uKGlkKXtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZT0+e1xuICAgICAgICB0aGlzLnBlZXIgPSBuZXcgUGVlcih0aGlzLnNvY2tldC5pZCx7a2V5OiBpZCxob3N0Oidsb2NhbGhvc3QnLHBvcnQ6MzAwMCxwYXRoOicvcGVlcmpzJ30pO1xuICAgICAgICB0aGlzLnBlZXIub24oJ2Vycm9yJyxlcnJvcj0+e1xuICAgICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgICAgICAgdGhpcy5wZWVyLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucGVlci5vbignY29ubmVjdGlvbicsdGhpcy5vbkNvbm5lY3Rpb24uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgdGhpcy5wZWVyLm9uKCdvcGVuJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5pZCA9IGlkO1xuICAgICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgIH0pO1xuICAgIH0pXG59O1xuXG5fUm9vbS5wcm90b3R5cGUuc3RhcnQgPSBmdW5jdGlvbigpe1xuICAgIHRoaXMuc29ja2V0LmVtaXQoJ3N0YXJ0LXJvb20nLHRoaXMuaWQpXG59O1xuX1Jvb20ucHJvdG90eXBlLmNvbm5lY3RUbyA9IGZ1bmN0aW9uKGlkKXtcbiAgICBpZih0aGlzLnBlZXIuY29ubmVjdGlvbnNbaWRdKSByZXR1cm47XG4gICAgdGhpcy5zdGFydGluZ1tpZF0gPSBuZXcgRGF0ZSgpO1xuICAgIHJldHVybiB0aGlzLm9uQ29ubmVjdGlvbih0aGlzLnBlZXIuY29ubmVjdChpZCkpO1xufTtcbl9Sb29tLnByb3RvdHlwZS5vbkNvbm5lY3Rpb24gPSBmdW5jdGlvbihjb25uKXtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZT0+e1xuICAgICAgICBjb25uLm9uKCdvcGVuJywoKT0+e1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgdGhpcy5vblBlZXJDb25uZWN0ZWQuZGlzcGF0Y2goY29ubik7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25uLm9uKCdkYXRhJyxkYXRhPT57XG4gICAgICAgICAgICB0aGlzLm9uRGF0YVJlY2VpdmVkLmRpc3BhdGNoKGRhdGEpXG4gICAgICAgIH0pO1xuICAgICAgICBjb25uLm9uKCdjbG9zZScsKCk9PntcbiAgICAgICAgICAgIHRoaXMub25QZWVyRGlzY29ubmVjdGVkLmRpc3BhdGNoKGNvbm4ucGVlcik7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5wZWVyLmNvbm5lY3Rpb25zW2Nvbm4ucGVlcl07XG4gICAgICAgIH0pXG4gICAgfSlcblxuXG59XG5fUm9vbS5wcm90b3R5cGUuc2V0SG9zdCA9IGZ1bmN0aW9uKHBlZXIpe1xuICAgIHZhciBwcmV2aW91c0hvc3QgPSB0aGlzLmhvc3Q7XG4gICAgdGhpcy5ob3N0ID0gcGVlcjtcbiAgICB0aGlzLmlzSG9zdCA9IHRoaXMuaG9zdCA9PSB0aGlzLnNvY2tldC5pZDtcbiAgICB0aGlzLm9uSG9zdFNldC5kaXNwYXRjaCgpO1xuICAgIC8vIGlmKCF0aGlzLmdhbWUpXG4gICAgLy8gICAgIHRoaXMuZ2FtZSA9IG5ldyBHYW1lQnJva2VyKHRoaXMpXG4gICAgLy8gZWxzZXtcbiAgICAvLyAgICAgdGhpcy5nYW1lLnVwZGF0ZUhvc3QocHJldmlvdXNIb3N0KTtcbiAgICAvLyB9XG59O1xuX1Jvb20ucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpe1xuICAgIHRoaXMucGVlciAmJiB0aGlzLnBlZXIuZGVzdHJveSgpO1xuICAgIHRoaXMub25Ib3N0U2V0LnJlbW92ZUFsbCgpXG4gICAgdGhpcy5vblBlZXJDb25uZWN0ZWQucmVtb3ZlQWxsKCk7XG4gICAgdGhpcy5vblBlZXJEaXNjb25uZWN0ZWQucmVtb3ZlQWxsKCk7XG59O1xudmFyIE5vdGlmaWNhdGlvbiA9IGZ1bmN0aW9uKCl7XG4gICAgdGhpcy5kYXRhID0ge307XG4gICAgdGhpcy5uZXdQbGF5ZXIgPSBmdW5jdGlvbihpZCl7XG4gICAgICAgIHRoaXMuZGF0YVsnbnAnXSA9IHRoaXMuZGF0YVsnbnAnXSB8fCB7fTtcbiAgICAgICAgdGhpcy5kYXRhWyducCddW2lkXT0xO1xuICAgIH07XG4gICAgdGhpcy5yZW1vdmVQbGF5ZXIgPSBmdW5jdGlvbihpZCl7XG4gICAgICAgIHRoaXMuZGF0YVsncnAnXSA9IHRoaXMuZGF0YVsncnAnXSB8fCB7fTtcbiAgICAgICAgdGhpcy5kYXRhWydycCddW2lkXT0xO1xuICAgIH07XG4gICAgdGhpcy5hZGRQb3NpdGlvbiA9IGZ1bmN0aW9uKGlkLHBvc2l0aW9uKXtcbiAgICAgICAgdGhpcy5kYXRhWydwJ10gPSB0aGlzLmRhdGFbJ3AnXSB8fCB7fTtcbiAgICAgICAgdGhpcy5kYXRhWydwJ11baWRdPXBvc2l0aW9uO1xuICAgIH07XG4gICAgdGhpcy5yZXNldCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHRoaXMuZGF0YSA9IHt9O1xuICAgIH07XG4gICAgdGhpcy50b09iamVjdCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGE7XG4gICAgfVxufTtcbnZhciBHYW1lQnJva2VyID0gZnVuY3Rpb24ocm9vbSxvcHRpb25zKXtcbiAgICB0aGlzLm9wdGlvbnMgPSBfLmV4dGVuZCh7XG4gICAgICAgIHVwZGF0ZVN0ZXA6MTAwMFxuICAgIH0sb3B0aW9ucylcbiAgICB0aGlzLnNvY2tldCA9IHJvb20uc29ja2V0O1xuICAgIHRoaXMucm9vbSA9IHJvb207XG4gICAgdGhpcy5wZWVyID0gdGhpcy5yb29tLnBlZXI7XG4gICAgdGhpcy5uZXh0VXBkYXRlRGF0YSA9IG5ldyBOb3RpZmljYXRpb24oKTtcblxuICAgIHRoaXMub25EYXRhUmVjZWl2ZWQgPSB0aGlzLnJvb20ub25EYXRhUmVjZWl2ZWQ7XG4gICAgdGhpcy5vbkhvc3RDaGFuZ2VkID0gdGhpcy5yb29tLm9uSG9zdFNldDtcbiAgICB0aGlzLm9uUGxheWVyQ29ubmVjdGVkID0gbmV3IHNpZ25hbHMuU2lnbmFsKCk7XG4gICAgdGhpcy5vblBsYXllckRpc2Nvbm5lY3RlZCA9IG5ldyBzaWduYWxzLlNpZ25hbCgpO1xuICAgIHRoaXMucm9vbS5vblBlZXJDb25uZWN0ZWQuYWRkKGNvbm49PnRoaXMucm9vbS5pc0hvc3QgJiYgdGhpcy5vblBsYXllckNvbm5lY3RlZC5kaXNwYXRjaChjb25uKSk7XG4gICAgdGhpcy5yb29tLm9uUGVlckRpc2Nvbm5lY3RlZC5hZGQoaWQ9PnRoaXMucm9vbS5pc0hvc3QgJiYgdGhpcy5vblBsYXllckRpc2Nvbm5lY3RlZC5kaXNwYXRjaChpZCkpO1xuXG4gICAgdGhpcy5zZW5kVXBkYXRlKCk7XG59O1xuXG5HYW1lQnJva2VyLnByb3RvdHlwZS5zZW5kVXBkYXRlID0gZnVuY3Rpb24oKXtcbiAgICB2YXIgZGF0YTtcbiAgICBpZih0aGlzLnBlZXIgJiYgdGhpcy5yb29tLmhvc3Qpe1xuICAgICAgICBkYXRhID0gdGhpcy5uZXh0VXBkYXRlRGF0YS50b09iamVjdCgpO1xuICAgICAgICBpZighT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoKSByZXR1cm47XG4gICAgICAgIGlmKHRoaXMucm9vbS5pc0hvc3Qpe1xuICAgICAgICAgICAgZm9yKHZhciBjb25uSWQgaW4gdGhpcy5wZWVyLmNvbm5lY3Rpb25zKXtcbiAgICAgICAgICAgICAgICB0aGlzLnBlZXIuY29ubmVjdGlvbnNbY29ubklkXVswXS5zZW5kKGRhdGEpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhpcy5wZWVyLmNvbm5lY3Rpb25zW3RoaXMucm9vbS5ob3N0XSAmJiB0aGlzLnBlZXIuY29ubmVjdGlvbnNbdGhpcy5yb29tLmhvc3RdWzBdLnNlbmQoZGF0YSlcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm5leHRVcGRhdGVEYXRhLnJlc2V0KCk7XG4gICAgc2V0VGltZW91dCh0aGlzLnNlbmRVcGRhdGUuYmluZCh0aGlzKSx0aGlzLm9wdGlvbnMudXBkYXRlU3RlcCk7XG59O1xuXG5HYW1lQnJva2VyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKXtcbiAgICB0aGlzLnJvb20uZGVzdHJveSgpXG59O1xudmFyIFBsYXllciA9IGZ1bmN0aW9uKCl7XG4gICAgdGhpcy5wb3NpdGlvbiA9IDE7XG4gICAgdGhpcy52ZWwgPSAxO1xuICAgIHRoaXMuc3RlcCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gdGhpcy52ZWw7XG4gICAgfVxufVxudmFyIEdhbWUgPSBmdW5jdGlvbihicm9rZXIsb3B0aW9ucyl7XG4gICAgdGhpcy5icm9rZXIgPSBicm9rZXI7XG4gICAgdGhpcy5wbGF5ZXJzID0ge307XG4gICAgdGhpcy5ydW4gPSBmYWxzZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBfLmV4dGVuZCh7c3RlcFRpbWU6MTAwLG9wdGlvbnN9KTtcblxufTtcbkdhbWUucHJvdG90eXBlID0ge1xuICAgIGFkZFBsYXllcjpmdW5jdGlvbihpZCl7XG4gICAgICAgIHRoaXMucGxheWVyc1tpZF0gPSBuZXcgUGxheWVyKClcbiAgICB9LFxuICAgIHJlbW92ZVBsYXllcjpmdW5jdGlvbihpZCl7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnBsYXllcnNbaWRdXG4gICAgfSxcbiAgICBzdGVwOmZ1bmN0aW9uKCl7XG4gICAgICAgIGlmKHRoaXMucnVuKXtcbiAgICAgICAgICAgIHZhciBwSWQgPSBfLnJhbmRPcHRpb25zKE9iamVjdC5rZXlzKHRoaXMucGxheWVycykpO1xuICAgICAgICAgICAgdGhpcy5wbGF5ZXJzW3BJZF0uc3RlcCgpO1xuICAgICAgICAgICAgdGhpcy5icm9rZXIubmV4dFVwZGF0ZURhdGEuYWRkUG9zaXRpb24ocElkLHRoaXMucGxheWVyc1twSWRdLnBvc2l0aW9uKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgdXBkYXRlU3RhdGU6ZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGlmKGRhdGEubnApXG4gICAgICAgICAgICBmb3IgKHZhciBpIGluIGRhdGEubnApXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRQbGF5ZXIoaSk7XG4gICAgICAgIGlmKGRhdGEucnApXG4gICAgICAgICAgICBmb3IgKHZhciBpIGluIGRhdGEubnApXG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVQbGF5ZXIoaSk7XG5cbiAgICAgICAgaWYoZGF0YS5wKVxuICAgICAgICAgICAgZm9yICh2YXIgaWQgaW4gZGF0YS5wKVxuICAgICAgICAgICAgICAgIHRoaXMucGxheWVyc1tpZF0ucG9zaXRpb24gPSBkYXRhLnBbaWRdXG4gICAgfSxcbiAgICBpbml0aWFsU3RhdGU6ZnVuY3Rpb24oKXtcbiAgICAgICAgZm9yKHZhciBpZCBpbiB0aGlzLnBsYXllcnMpe1xuICAgICAgICAgICAgdGhpcy5icm9rZXIubmV4dFVwZGF0ZURhdGEubmV3UGxheWVyKGlkKTtcbiAgICAgICAgICAgIHRoaXMuYnJva2VyLm5leHRVcGRhdGVEYXRhLmFkZFBvc2l0aW9uKGlkLCB0aGlzLnBsYXllcnNbaWRdLnBvc2l0aW9uKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgTG9iYnk6TG9iYnksXG4gICAgR2FtZUJyb2tlcjpHYW1lQnJva2VyXG59O1xud2luZG93LkxvYmJ5ID0gTG9iYnk7XG53aW5kb3cuR2FtZUJyb2tlciA9IEdhbWVCcm9rZXI7XG53aW5kb3cuR2FtZSA9IEdhbWU7XG4iLCIhZnVuY3Rpb24odCxlKXtcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyYmXCJvYmplY3RcIj09dHlwZW9mIG1vZHVsZT9tb2R1bGUuZXhwb3J0cz1lKCk6XCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kP2RlZmluZShbXSxlKTpcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cz9leHBvcnRzLmlvPWUoKTp0LmlvPWUoKX0odGhpcyxmdW5jdGlvbigpe3JldHVybiBmdW5jdGlvbih0KXtmdW5jdGlvbiBlKHIpe2lmKG5bcl0pcmV0dXJuIG5bcl0uZXhwb3J0czt2YXIgbz1uW3JdPXtleHBvcnRzOnt9LGlkOnIsbG9hZGVkOiExfTtyZXR1cm4gdFtyXS5jYWxsKG8uZXhwb3J0cyxvLG8uZXhwb3J0cyxlKSxvLmxvYWRlZD0hMCxvLmV4cG9ydHN9dmFyIG49e307cmV0dXJuIGUubT10LGUuYz1uLGUucD1cIlwiLGUoMCl9KFtmdW5jdGlvbih0LGUsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gcih0LGUpe1wib2JqZWN0XCI9PT0oXCJ1bmRlZmluZWRcIj09dHlwZW9mIHQ/XCJ1bmRlZmluZWRcIjpvKHQpKSYmKGU9dCx0PXZvaWQgMCksZT1lfHx7fTt2YXIgbixyPWkodCkscz1yLnNvdXJjZSx1PXIuaWQsaD1yLnBhdGgsZj1wW3VdJiZoIGluIHBbdV0ubnNwcyxsPWUuZm9yY2VOZXd8fGVbXCJmb3JjZSBuZXcgY29ubmVjdGlvblwiXXx8ITE9PT1lLm11bHRpcGxleHx8ZjtyZXR1cm4gbD8oYyhcImlnbm9yaW5nIHNvY2tldCBjYWNoZSBmb3IgJXNcIixzKSxuPWEocyxlKSk6KHBbdV18fChjKFwibmV3IGlvIGluc3RhbmNlIGZvciAlc1wiLHMpLHBbdV09YShzLGUpKSxuPXBbdV0pLHIucXVlcnkmJiFlLnF1ZXJ5JiYoZS5xdWVyeT1yLnF1ZXJ5KSxuLnNvY2tldChyLnBhdGgsZSl9dmFyIG89XCJmdW5jdGlvblwiPT10eXBlb2YgU3ltYm9sJiZcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLml0ZXJhdG9yP2Z1bmN0aW9uKHQpe3JldHVybiB0eXBlb2YgdH06ZnVuY3Rpb24odCl7cmV0dXJuIHQmJlwiZnVuY3Rpb25cIj09dHlwZW9mIFN5bWJvbCYmdC5jb25zdHJ1Y3Rvcj09PVN5bWJvbCYmdCE9PVN5bWJvbC5wcm90b3R5cGU/XCJzeW1ib2xcIjp0eXBlb2YgdH0saT1uKDEpLHM9big3KSxhPW4oMTMpLGM9bigzKShcInNvY2tldC5pby1jbGllbnRcIik7dC5leHBvcnRzPWU9cjt2YXIgcD1lLm1hbmFnZXJzPXt9O2UucHJvdG9jb2w9cy5wcm90b2NvbCxlLmNvbm5lY3Q9cixlLk1hbmFnZXI9bigxMyksZS5Tb2NrZXQ9bigzOSl9LGZ1bmN0aW9uKHQsZSxuKXsoZnVuY3Rpb24oZSl7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gcih0LG4pe3ZhciByPXQ7bj1ufHxlLmxvY2F0aW9uLG51bGw9PXQmJih0PW4ucHJvdG9jb2wrXCIvL1wiK24uaG9zdCksXCJzdHJpbmdcIj09dHlwZW9mIHQmJihcIi9cIj09PXQuY2hhckF0KDApJiYodD1cIi9cIj09PXQuY2hhckF0KDEpP24ucHJvdG9jb2wrdDpuLmhvc3QrdCksL14oaHR0cHM/fHdzcz8pOlxcL1xcLy8udGVzdCh0KXx8KGkoXCJwcm90b2NvbC1sZXNzIHVybCAlc1wiLHQpLHQ9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIG4/bi5wcm90b2NvbCtcIi8vXCIrdDpcImh0dHBzOi8vXCIrdCksaShcInBhcnNlICVzXCIsdCkscj1vKHQpKSxyLnBvcnR8fCgvXihodHRwfHdzKSQvLnRlc3Qoci5wcm90b2NvbCk/ci5wb3J0PVwiODBcIjovXihodHRwfHdzKXMkLy50ZXN0KHIucHJvdG9jb2wpJiYoci5wb3J0PVwiNDQzXCIpKSxyLnBhdGg9ci5wYXRofHxcIi9cIjt2YXIgcz1yLmhvc3QuaW5kZXhPZihcIjpcIikhPT0tMSxhPXM/XCJbXCIrci5ob3N0K1wiXVwiOnIuaG9zdDtyZXR1cm4gci5pZD1yLnByb3RvY29sK1wiOi8vXCIrYStcIjpcIityLnBvcnQsci5ocmVmPXIucHJvdG9jb2wrXCI6Ly9cIithKyhuJiZuLnBvcnQ9PT1yLnBvcnQ/XCJcIjpcIjpcIityLnBvcnQpLHJ9dmFyIG89bigyKSxpPW4oMykoXCJzb2NrZXQuaW8tY2xpZW50OnVybFwiKTt0LmV4cG9ydHM9cn0pLmNhbGwoZSxmdW5jdGlvbigpe3JldHVybiB0aGlzfSgpKX0sZnVuY3Rpb24odCxlKXt2YXIgbj0vXig/Oig/IVteOkBdKzpbXjpAXFwvXSpAKShodHRwfGh0dHBzfHdzfHdzcyk6XFwvXFwvKT8oKD86KChbXjpAXSopKD86OihbXjpAXSopKT8pP0ApPygoPzpbYS1mMC05XXswLDR9Oil7Miw3fVthLWYwLTldezAsNH18W146XFwvPyNdKikoPzo6KFxcZCopKT8pKCgoXFwvKD86W14/I10oPyFbXj8jXFwvXSpcXC5bXj8jXFwvLl0rKD86Wz8jXXwkKSkpKlxcLz8pPyhbXj8jXFwvXSopKSg/OlxcPyhbXiNdKikpPyg/OiMoLiopKT8pLyxyPVtcInNvdXJjZVwiLFwicHJvdG9jb2xcIixcImF1dGhvcml0eVwiLFwidXNlckluZm9cIixcInVzZXJcIixcInBhc3N3b3JkXCIsXCJob3N0XCIsXCJwb3J0XCIsXCJyZWxhdGl2ZVwiLFwicGF0aFwiLFwiZGlyZWN0b3J5XCIsXCJmaWxlXCIsXCJxdWVyeVwiLFwiYW5jaG9yXCJdO3QuZXhwb3J0cz1mdW5jdGlvbih0KXt2YXIgZT10LG89dC5pbmRleE9mKFwiW1wiKSxpPXQuaW5kZXhPZihcIl1cIik7byE9LTEmJmkhPS0xJiYodD10LnN1YnN0cmluZygwLG8pK3Quc3Vic3RyaW5nKG8saSkucmVwbGFjZSgvOi9nLFwiO1wiKSt0LnN1YnN0cmluZyhpLHQubGVuZ3RoKSk7Zm9yKHZhciBzPW4uZXhlYyh0fHxcIlwiKSxhPXt9LGM9MTQ7Yy0tOylhW3JbY11dPXNbY118fFwiXCI7cmV0dXJuIG8hPS0xJiZpIT0tMSYmKGEuc291cmNlPWUsYS5ob3N0PWEuaG9zdC5zdWJzdHJpbmcoMSxhLmhvc3QubGVuZ3RoLTEpLnJlcGxhY2UoLzsvZyxcIjpcIiksYS5hdXRob3JpdHk9YS5hdXRob3JpdHkucmVwbGFjZShcIltcIixcIlwiKS5yZXBsYWNlKFwiXVwiLFwiXCIpLnJlcGxhY2UoLzsvZyxcIjpcIiksYS5pcHY2dXJpPSEwKSxhfX0sZnVuY3Rpb24odCxlLG4peyhmdW5jdGlvbihyKXtmdW5jdGlvbiBvKCl7cmV0dXJuIShcInVuZGVmaW5lZFwiPT10eXBlb2Ygd2luZG93fHwhd2luZG93LnByb2Nlc3N8fFwicmVuZGVyZXJcIiE9PXdpbmRvdy5wcm9jZXNzLnR5cGUpfHwoXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGRvY3VtZW50JiZkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQmJmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSYmZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLldlYmtpdEFwcGVhcmFuY2V8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiB3aW5kb3cmJndpbmRvdy5jb25zb2xlJiYod2luZG93LmNvbnNvbGUuZmlyZWJ1Z3x8d2luZG93LmNvbnNvbGUuZXhjZXB0aW9uJiZ3aW5kb3cuY29uc29sZS50YWJsZSl8fFwidW5kZWZpbmVkXCIhPXR5cGVvZiBuYXZpZ2F0b3ImJm5hdmlnYXRvci51c2VyQWdlbnQmJm5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pJiZwYXJzZUludChSZWdFeHAuJDEsMTApPj0zMXx8XCJ1bmRlZmluZWRcIiE9dHlwZW9mIG5hdmlnYXRvciYmbmF2aWdhdG9yLnVzZXJBZ2VudCYmbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpLm1hdGNoKC9hcHBsZXdlYmtpdFxcLyhcXGQrKS8pKX1mdW5jdGlvbiBpKHQpe3ZhciBuPXRoaXMudXNlQ29sb3JzO2lmKHRbMF09KG4/XCIlY1wiOlwiXCIpK3RoaXMubmFtZXNwYWNlKyhuP1wiICVjXCI6XCIgXCIpK3RbMF0rKG4/XCIlYyBcIjpcIiBcIikrXCIrXCIrZS5odW1hbml6ZSh0aGlzLmRpZmYpLG4pe3ZhciByPVwiY29sb3I6IFwiK3RoaXMuY29sb3I7dC5zcGxpY2UoMSwwLHIsXCJjb2xvcjogaW5oZXJpdFwiKTt2YXIgbz0wLGk9MDt0WzBdLnJlcGxhY2UoLyVbYS16QS1aJV0vZyxmdW5jdGlvbih0KXtcIiUlXCIhPT10JiYobysrLFwiJWNcIj09PXQmJihpPW8pKX0pLHQuc3BsaWNlKGksMCxyKX19ZnVuY3Rpb24gcygpe3JldHVyblwib2JqZWN0XCI9PXR5cGVvZiBjb25zb2xlJiZjb25zb2xlLmxvZyYmRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5sb2csY29uc29sZSxhcmd1bWVudHMpfWZ1bmN0aW9uIGEodCl7dHJ5e251bGw9PXQ/ZS5zdG9yYWdlLnJlbW92ZUl0ZW0oXCJkZWJ1Z1wiKTplLnN0b3JhZ2UuZGVidWc9dH1jYXRjaChuKXt9fWZ1bmN0aW9uIGMoKXt2YXIgdDt0cnl7dD1lLnN0b3JhZ2UuZGVidWd9Y2F0Y2gobil7fXJldHVybiF0JiZcInVuZGVmaW5lZFwiIT10eXBlb2YgciYmXCJlbnZcImluIHImJih0PXIuZW52LkRFQlVHKSx0fWZ1bmN0aW9uIHAoKXt0cnl7cmV0dXJuIHdpbmRvdy5sb2NhbFN0b3JhZ2V9Y2F0Y2godCl7fX1lPXQuZXhwb3J0cz1uKDUpLGUubG9nPXMsZS5mb3JtYXRBcmdzPWksZS5zYXZlPWEsZS5sb2FkPWMsZS51c2VDb2xvcnM9byxlLnN0b3JhZ2U9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGNocm9tZSYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIGNocm9tZS5zdG9yYWdlP2Nocm9tZS5zdG9yYWdlLmxvY2FsOnAoKSxlLmNvbG9ycz1bXCJsaWdodHNlYWdyZWVuXCIsXCJmb3Jlc3RncmVlblwiLFwiZ29sZGVucm9kXCIsXCJkb2RnZXJibHVlXCIsXCJkYXJrb3JjaGlkXCIsXCJjcmltc29uXCJdLGUuZm9ybWF0dGVycy5qPWZ1bmN0aW9uKHQpe3RyeXtyZXR1cm4gSlNPTi5zdHJpbmdpZnkodCl9Y2F0Y2goZSl7cmV0dXJuXCJbVW5leHBlY3RlZEpTT05QYXJzZUVycm9yXTogXCIrZS5tZXNzYWdlfX0sZS5lbmFibGUoYygpKX0pLmNhbGwoZSxuKDQpKX0sZnVuY3Rpb24odCxlKXtmdW5jdGlvbiBuKCl7dGhyb3cgbmV3IEVycm9yKFwic2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZFwiKX1mdW5jdGlvbiByKCl7dGhyb3cgbmV3IEVycm9yKFwiY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkXCIpfWZ1bmN0aW9uIG8odCl7aWYodT09PXNldFRpbWVvdXQpcmV0dXJuIHNldFRpbWVvdXQodCwwKTtpZigodT09PW58fCF1KSYmc2V0VGltZW91dClyZXR1cm4gdT1zZXRUaW1lb3V0LHNldFRpbWVvdXQodCwwKTt0cnl7cmV0dXJuIHUodCwwKX1jYXRjaChlKXt0cnl7cmV0dXJuIHUuY2FsbChudWxsLHQsMCl9Y2F0Y2goZSl7cmV0dXJuIHUuY2FsbCh0aGlzLHQsMCl9fX1mdW5jdGlvbiBpKHQpe2lmKGg9PT1jbGVhclRpbWVvdXQpcmV0dXJuIGNsZWFyVGltZW91dCh0KTtpZigoaD09PXJ8fCFoKSYmY2xlYXJUaW1lb3V0KXJldHVybiBoPWNsZWFyVGltZW91dCxjbGVhclRpbWVvdXQodCk7dHJ5e3JldHVybiBoKHQpfWNhdGNoKGUpe3RyeXtyZXR1cm4gaC5jYWxsKG51bGwsdCl9Y2F0Y2goZSl7cmV0dXJuIGguY2FsbCh0aGlzLHQpfX19ZnVuY3Rpb24gcygpe3kmJmwmJih5PSExLGwubGVuZ3RoP2Q9bC5jb25jYXQoZCk6bT0tMSxkLmxlbmd0aCYmYSgpKX1mdW5jdGlvbiBhKCl7aWYoIXkpe3ZhciB0PW8ocyk7eT0hMDtmb3IodmFyIGU9ZC5sZW5ndGg7ZTspe2ZvcihsPWQsZD1bXTsrK208ZTspbCYmbFttXS5ydW4oKTttPS0xLGU9ZC5sZW5ndGh9bD1udWxsLHk9ITEsaSh0KX19ZnVuY3Rpb24gYyh0LGUpe3RoaXMuZnVuPXQsdGhpcy5hcnJheT1lfWZ1bmN0aW9uIHAoKXt9dmFyIHUsaCxmPXQuZXhwb3J0cz17fTshZnVuY3Rpb24oKXt0cnl7dT1cImZ1bmN0aW9uXCI9PXR5cGVvZiBzZXRUaW1lb3V0P3NldFRpbWVvdXQ6bn1jYXRjaCh0KXt1PW59dHJ5e2g9XCJmdW5jdGlvblwiPT10eXBlb2YgY2xlYXJUaW1lb3V0P2NsZWFyVGltZW91dDpyfWNhdGNoKHQpe2g9cn19KCk7dmFyIGwsZD1bXSx5PSExLG09LTE7Zi5uZXh0VGljaz1mdW5jdGlvbih0KXt2YXIgZT1uZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aC0xKTtpZihhcmd1bWVudHMubGVuZ3RoPjEpZm9yKHZhciBuPTE7bjxhcmd1bWVudHMubGVuZ3RoO24rKyllW24tMV09YXJndW1lbnRzW25dO2QucHVzaChuZXcgYyh0LGUpKSwxIT09ZC5sZW5ndGh8fHl8fG8oYSl9LGMucHJvdG90eXBlLnJ1bj1mdW5jdGlvbigpe3RoaXMuZnVuLmFwcGx5KG51bGwsdGhpcy5hcnJheSl9LGYudGl0bGU9XCJicm93c2VyXCIsZi5icm93c2VyPSEwLGYuZW52PXt9LGYuYXJndj1bXSxmLnZlcnNpb249XCJcIixmLnZlcnNpb25zPXt9LGYub249cCxmLmFkZExpc3RlbmVyPXAsZi5vbmNlPXAsZi5vZmY9cCxmLnJlbW92ZUxpc3RlbmVyPXAsZi5yZW1vdmVBbGxMaXN0ZW5lcnM9cCxmLmVtaXQ9cCxmLnByZXBlbmRMaXN0ZW5lcj1wLGYucHJlcGVuZE9uY2VMaXN0ZW5lcj1wLGYubGlzdGVuZXJzPWZ1bmN0aW9uKHQpe3JldHVybltdfSxmLmJpbmRpbmc9ZnVuY3Rpb24odCl7dGhyb3cgbmV3IEVycm9yKFwicHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWRcIil9LGYuY3dkPWZ1bmN0aW9uKCl7cmV0dXJuXCIvXCJ9LGYuY2hkaXI9ZnVuY3Rpb24odCl7dGhyb3cgbmV3IEVycm9yKFwicHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkXCIpfSxmLnVtYXNrPWZ1bmN0aW9uKCl7cmV0dXJuIDB9fSxmdW5jdGlvbih0LGUsbil7ZnVuY3Rpb24gcih0KXt2YXIgbixyPTA7Zm9yKG4gaW4gdClyPShyPDw1KS1yK3QuY2hhckNvZGVBdChuKSxyfD0wO3JldHVybiBlLmNvbG9yc1tNYXRoLmFicyhyKSVlLmNvbG9ycy5sZW5ndGhdfWZ1bmN0aW9uIG8odCl7ZnVuY3Rpb24gbigpe2lmKG4uZW5hYmxlZCl7dmFyIHQ9bixyPStuZXcgRGF0ZSxvPXItKHB8fHIpO3QuZGlmZj1vLHQucHJldj1wLHQuY3Vycj1yLHA9cjtmb3IodmFyIGk9bmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGgpLHM9MDtzPGkubGVuZ3RoO3MrKylpW3NdPWFyZ3VtZW50c1tzXTtpWzBdPWUuY29lcmNlKGlbMF0pLFwic3RyaW5nXCIhPXR5cGVvZiBpWzBdJiZpLnVuc2hpZnQoXCIlT1wiKTt2YXIgYT0wO2lbMF09aVswXS5yZXBsYWNlKC8lKFthLXpBLVolXSkvZyxmdW5jdGlvbihuLHIpe2lmKFwiJSVcIj09PW4pcmV0dXJuIG47YSsrO3ZhciBvPWUuZm9ybWF0dGVyc1tyXTtpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiBvKXt2YXIgcz1pW2FdO249by5jYWxsKHQscyksaS5zcGxpY2UoYSwxKSxhLS19cmV0dXJuIG59KSxlLmZvcm1hdEFyZ3MuY2FsbCh0LGkpO3ZhciBjPW4ubG9nfHxlLmxvZ3x8Y29uc29sZS5sb2cuYmluZChjb25zb2xlKTtjLmFwcGx5KHQsaSl9fXJldHVybiBuLm5hbWVzcGFjZT10LG4uZW5hYmxlZD1lLmVuYWJsZWQodCksbi51c2VDb2xvcnM9ZS51c2VDb2xvcnMoKSxuLmNvbG9yPXIodCksXCJmdW5jdGlvblwiPT10eXBlb2YgZS5pbml0JiZlLmluaXQobiksbn1mdW5jdGlvbiBpKHQpe2Uuc2F2ZSh0KSxlLm5hbWVzPVtdLGUuc2tpcHM9W107Zm9yKHZhciBuPShcInN0cmluZ1wiPT10eXBlb2YgdD90OlwiXCIpLnNwbGl0KC9bXFxzLF0rLykscj1uLmxlbmd0aCxvPTA7bzxyO28rKyluW29dJiYodD1uW29dLnJlcGxhY2UoL1xcKi9nLFwiLio/XCIpLFwiLVwiPT09dFswXT9lLnNraXBzLnB1c2gobmV3IFJlZ0V4cChcIl5cIit0LnN1YnN0cigxKStcIiRcIikpOmUubmFtZXMucHVzaChuZXcgUmVnRXhwKFwiXlwiK3QrXCIkXCIpKSl9ZnVuY3Rpb24gcygpe2UuZW5hYmxlKFwiXCIpfWZ1bmN0aW9uIGEodCl7dmFyIG4scjtmb3Iobj0wLHI9ZS5za2lwcy5sZW5ndGg7bjxyO24rKylpZihlLnNraXBzW25dLnRlc3QodCkpcmV0dXJuITE7Zm9yKG49MCxyPWUubmFtZXMubGVuZ3RoO248cjtuKyspaWYoZS5uYW1lc1tuXS50ZXN0KHQpKXJldHVybiEwO3JldHVybiExfWZ1bmN0aW9uIGModCl7cmV0dXJuIHQgaW5zdGFuY2VvZiBFcnJvcj90LnN0YWNrfHx0Lm1lc3NhZ2U6dH1lPXQuZXhwb3J0cz1vLmRlYnVnPW9bXCJkZWZhdWx0XCJdPW8sZS5jb2VyY2U9YyxlLmRpc2FibGU9cyxlLmVuYWJsZT1pLGUuZW5hYmxlZD1hLGUuaHVtYW5pemU9big2KSxlLm5hbWVzPVtdLGUuc2tpcHM9W10sZS5mb3JtYXR0ZXJzPXt9O3ZhciBwfSxmdW5jdGlvbih0LGUpe2Z1bmN0aW9uIG4odCl7aWYodD1TdHJpbmcodCksISh0Lmxlbmd0aD4xMDApKXt2YXIgZT0vXigoPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKHQpO2lmKGUpe3ZhciBuPXBhcnNlRmxvYXQoZVsxXSkscj0oZVsyXXx8XCJtc1wiKS50b0xvd2VyQ2FzZSgpO3N3aXRjaChyKXtjYXNlXCJ5ZWFyc1wiOmNhc2VcInllYXJcIjpjYXNlXCJ5cnNcIjpjYXNlXCJ5clwiOmNhc2VcInlcIjpyZXR1cm4gbip1O2Nhc2VcImRheXNcIjpjYXNlXCJkYXlcIjpjYXNlXCJkXCI6cmV0dXJuIG4qcDtjYXNlXCJob3Vyc1wiOmNhc2VcImhvdXJcIjpjYXNlXCJocnNcIjpjYXNlXCJoclwiOmNhc2VcImhcIjpyZXR1cm4gbipjO2Nhc2VcIm1pbnV0ZXNcIjpjYXNlXCJtaW51dGVcIjpjYXNlXCJtaW5zXCI6Y2FzZVwibWluXCI6Y2FzZVwibVwiOnJldHVybiBuKmE7Y2FzZVwic2Vjb25kc1wiOmNhc2VcInNlY29uZFwiOmNhc2VcInNlY3NcIjpjYXNlXCJzZWNcIjpjYXNlXCJzXCI6cmV0dXJuIG4qcztjYXNlXCJtaWxsaXNlY29uZHNcIjpjYXNlXCJtaWxsaXNlY29uZFwiOmNhc2VcIm1zZWNzXCI6Y2FzZVwibXNlY1wiOmNhc2VcIm1zXCI6cmV0dXJuIG47ZGVmYXVsdDpyZXR1cm59fX19ZnVuY3Rpb24gcih0KXtyZXR1cm4gdD49cD9NYXRoLnJvdW5kKHQvcCkrXCJkXCI6dD49Yz9NYXRoLnJvdW5kKHQvYykrXCJoXCI6dD49YT9NYXRoLnJvdW5kKHQvYSkrXCJtXCI6dD49cz9NYXRoLnJvdW5kKHQvcykrXCJzXCI6dCtcIm1zXCJ9ZnVuY3Rpb24gbyh0KXtyZXR1cm4gaSh0LHAsXCJkYXlcIil8fGkodCxjLFwiaG91clwiKXx8aSh0LGEsXCJtaW51dGVcIil8fGkodCxzLFwic2Vjb25kXCIpfHx0K1wiIG1zXCJ9ZnVuY3Rpb24gaSh0LGUsbil7aWYoISh0PGUpKXJldHVybiB0PDEuNSplP01hdGguZmxvb3IodC9lKStcIiBcIituOk1hdGguY2VpbCh0L2UpK1wiIFwiK24rXCJzXCJ9dmFyIHM9MWUzLGE9NjAqcyxjPTYwKmEscD0yNCpjLHU9MzY1LjI1KnA7dC5leHBvcnRzPWZ1bmN0aW9uKHQsZSl7ZT1lfHx7fTt2YXIgaT10eXBlb2YgdDtpZihcInN0cmluZ1wiPT09aSYmdC5sZW5ndGg+MClyZXR1cm4gbih0KTtpZihcIm51bWJlclwiPT09aSYmaXNOYU4odCk9PT0hMSlyZXR1cm4gZVtcImxvbmdcIl0/byh0KTpyKHQpO3Rocm93IG5ldyBFcnJvcihcInZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgdmFsaWQgbnVtYmVyLiB2YWw9XCIrSlNPTi5zdHJpbmdpZnkodCkpfX0sZnVuY3Rpb24odCxlLG4pe2Z1bmN0aW9uIHIoKXt9ZnVuY3Rpb24gbyh0KXt2YXIgbj1cIlwiK3QudHlwZTtyZXR1cm4gZS5CSU5BUllfRVZFTlQhPT10LnR5cGUmJmUuQklOQVJZX0FDSyE9PXQudHlwZXx8KG4rPXQuYXR0YWNobWVudHMrXCItXCIpLHQubnNwJiZcIi9cIiE9PXQubnNwJiYobis9dC5uc3ArXCIsXCIpLG51bGwhPXQuaWQmJihuKz10LmlkKSxudWxsIT10LmRhdGEmJihuKz1KU09OLnN0cmluZ2lmeSh0LmRhdGEpKSxoKFwiZW5jb2RlZCAlaiBhcyAlc1wiLHQsbiksbn1mdW5jdGlvbiBpKHQsZSl7ZnVuY3Rpb24gbih0KXt2YXIgbj1kLmRlY29uc3RydWN0UGFja2V0KHQpLHI9byhuLnBhY2tldCksaT1uLmJ1ZmZlcnM7aS51bnNoaWZ0KHIpLGUoaSl9ZC5yZW1vdmVCbG9icyh0LG4pfWZ1bmN0aW9uIHMoKXt0aGlzLnJlY29uc3RydWN0b3I9bnVsbH1mdW5jdGlvbiBhKHQpe3ZhciBuPTAscj17dHlwZTpOdW1iZXIodC5jaGFyQXQoMCkpfTtpZihudWxsPT1lLnR5cGVzW3IudHlwZV0pcmV0dXJuIHUoKTtpZihlLkJJTkFSWV9FVkVOVD09PXIudHlwZXx8ZS5CSU5BUllfQUNLPT09ci50eXBlKXtmb3IodmFyIG89XCJcIjtcIi1cIiE9PXQuY2hhckF0KCsrbikmJihvKz10LmNoYXJBdChuKSxuIT10Lmxlbmd0aCk7KTtpZihvIT1OdW1iZXIobyl8fFwiLVwiIT09dC5jaGFyQXQobikpdGhyb3cgbmV3IEVycm9yKFwiSWxsZWdhbCBhdHRhY2htZW50c1wiKTtyLmF0dGFjaG1lbnRzPU51bWJlcihvKX1pZihcIi9cIj09PXQuY2hhckF0KG4rMSkpZm9yKHIubnNwPVwiXCI7KytuOyl7dmFyIGk9dC5jaGFyQXQobik7aWYoXCIsXCI9PT1pKWJyZWFrO2lmKHIubnNwKz1pLG49PT10Lmxlbmd0aClicmVha31lbHNlIHIubnNwPVwiL1wiO3ZhciBzPXQuY2hhckF0KG4rMSk7aWYoXCJcIiE9PXMmJk51bWJlcihzKT09cyl7Zm9yKHIuaWQ9XCJcIjsrK247KXt2YXIgaT10LmNoYXJBdChuKTtpZihudWxsPT1pfHxOdW1iZXIoaSkhPWkpey0tbjticmVha31pZihyLmlkKz10LmNoYXJBdChuKSxuPT09dC5sZW5ndGgpYnJlYWt9ci5pZD1OdW1iZXIoci5pZCl9cmV0dXJuIHQuY2hhckF0KCsrbikmJihyPWMocix0LnN1YnN0cihuKSkpLGgoXCJkZWNvZGVkICVzIGFzICVqXCIsdCxyKSxyfWZ1bmN0aW9uIGModCxlKXt0cnl7dC5kYXRhPUpTT04ucGFyc2UoZSl9Y2F0Y2gobil7cmV0dXJuIHUoKX1yZXR1cm4gdH1mdW5jdGlvbiBwKHQpe3RoaXMucmVjb25QYWNrPXQsdGhpcy5idWZmZXJzPVtdfWZ1bmN0aW9uIHUoKXtyZXR1cm57dHlwZTplLkVSUk9SLGRhdGE6XCJwYXJzZXIgZXJyb3JcIn19dmFyIGg9bigzKShcInNvY2tldC5pby1wYXJzZXJcIiksZj1uKDgpLGw9big5KSxkPW4oMTEpLHk9bigxMik7ZS5wcm90b2NvbD00LGUudHlwZXM9W1wiQ09OTkVDVFwiLFwiRElTQ09OTkVDVFwiLFwiRVZFTlRcIixcIkFDS1wiLFwiRVJST1JcIixcIkJJTkFSWV9FVkVOVFwiLFwiQklOQVJZX0FDS1wiXSxlLkNPTk5FQ1Q9MCxlLkRJU0NPTk5FQ1Q9MSxlLkVWRU5UPTIsZS5BQ0s9MyxlLkVSUk9SPTQsZS5CSU5BUllfRVZFTlQ9NSxlLkJJTkFSWV9BQ0s9NixlLkVuY29kZXI9cixlLkRlY29kZXI9cyxyLnByb3RvdHlwZS5lbmNvZGU9ZnVuY3Rpb24odCxuKXtpZih0LnR5cGUhPT1lLkVWRU5UJiZ0LnR5cGUhPT1lLkFDS3x8IWwodC5kYXRhKXx8KHQudHlwZT10LnR5cGU9PT1lLkVWRU5UP2UuQklOQVJZX0VWRU5UOmUuQklOQVJZX0FDSyksaChcImVuY29kaW5nIHBhY2tldCAlalwiLHQpLGUuQklOQVJZX0VWRU5UPT09dC50eXBlfHxlLkJJTkFSWV9BQ0s9PT10LnR5cGUpaSh0LG4pO2Vsc2V7dmFyIHI9byh0KTtuKFtyXSl9fSxmKHMucHJvdG90eXBlKSxzLnByb3RvdHlwZS5hZGQ9ZnVuY3Rpb24odCl7dmFyIG47aWYoXCJzdHJpbmdcIj09dHlwZW9mIHQpbj1hKHQpLGUuQklOQVJZX0VWRU5UPT09bi50eXBlfHxlLkJJTkFSWV9BQ0s9PT1uLnR5cGU/KHRoaXMucmVjb25zdHJ1Y3Rvcj1uZXcgcChuKSwwPT09dGhpcy5yZWNvbnN0cnVjdG9yLnJlY29uUGFjay5hdHRhY2htZW50cyYmdGhpcy5lbWl0KFwiZGVjb2RlZFwiLG4pKTp0aGlzLmVtaXQoXCJkZWNvZGVkXCIsbik7ZWxzZXtpZigheSh0KSYmIXQuYmFzZTY0KXRocm93IG5ldyBFcnJvcihcIlVua25vd24gdHlwZTogXCIrdCk7aWYoIXRoaXMucmVjb25zdHJ1Y3Rvcil0aHJvdyBuZXcgRXJyb3IoXCJnb3QgYmluYXJ5IGRhdGEgd2hlbiBub3QgcmVjb25zdHJ1Y3RpbmcgYSBwYWNrZXRcIik7bj10aGlzLnJlY29uc3RydWN0b3IudGFrZUJpbmFyeURhdGEodCksbiYmKHRoaXMucmVjb25zdHJ1Y3Rvcj1udWxsLHRoaXMuZW1pdChcImRlY29kZWRcIixuKSl9fSxzLnByb3RvdHlwZS5kZXN0cm95PWZ1bmN0aW9uKCl7dGhpcy5yZWNvbnN0cnVjdG9yJiZ0aGlzLnJlY29uc3RydWN0b3IuZmluaXNoZWRSZWNvbnN0cnVjdGlvbigpfSxwLnByb3RvdHlwZS50YWtlQmluYXJ5RGF0YT1mdW5jdGlvbih0KXtpZih0aGlzLmJ1ZmZlcnMucHVzaCh0KSx0aGlzLmJ1ZmZlcnMubGVuZ3RoPT09dGhpcy5yZWNvblBhY2suYXR0YWNobWVudHMpe3ZhciBlPWQucmVjb25zdHJ1Y3RQYWNrZXQodGhpcy5yZWNvblBhY2ssdGhpcy5idWZmZXJzKTtyZXR1cm4gdGhpcy5maW5pc2hlZFJlY29uc3RydWN0aW9uKCksZX1yZXR1cm4gbnVsbH0scC5wcm90b3R5cGUuZmluaXNoZWRSZWNvbnN0cnVjdGlvbj1mdW5jdGlvbigpe3RoaXMucmVjb25QYWNrPW51bGwsdGhpcy5idWZmZXJzPVtdfX0sZnVuY3Rpb24odCxlLG4pe2Z1bmN0aW9uIHIodCl7aWYodClyZXR1cm4gbyh0KX1mdW5jdGlvbiBvKHQpe2Zvcih2YXIgZSBpbiByLnByb3RvdHlwZSl0W2VdPXIucHJvdG90eXBlW2VdO3JldHVybiB0fXQuZXhwb3J0cz1yLHIucHJvdG90eXBlLm9uPXIucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXI9ZnVuY3Rpb24odCxlKXtyZXR1cm4gdGhpcy5fY2FsbGJhY2tzPXRoaXMuX2NhbGxiYWNrc3x8e30sKHRoaXMuX2NhbGxiYWNrc1tcIiRcIit0XT10aGlzLl9jYWxsYmFja3NbXCIkXCIrdF18fFtdKS5wdXNoKGUpLHRoaXN9LHIucHJvdG90eXBlLm9uY2U9ZnVuY3Rpb24odCxlKXtmdW5jdGlvbiBuKCl7dGhpcy5vZmYodCxuKSxlLmFwcGx5KHRoaXMsYXJndW1lbnRzKX1yZXR1cm4gbi5mbj1lLHRoaXMub24odCxuKSx0aGlzfSxyLnByb3RvdHlwZS5vZmY9ci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXI9ci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzPXIucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXI9ZnVuY3Rpb24odCxlKXtpZih0aGlzLl9jYWxsYmFja3M9dGhpcy5fY2FsbGJhY2tzfHx7fSwwPT1hcmd1bWVudHMubGVuZ3RoKXJldHVybiB0aGlzLl9jYWxsYmFja3M9e30sdGhpczt2YXIgbj10aGlzLl9jYWxsYmFja3NbXCIkXCIrdF07aWYoIW4pcmV0dXJuIHRoaXM7aWYoMT09YXJndW1lbnRzLmxlbmd0aClyZXR1cm4gZGVsZXRlIHRoaXMuX2NhbGxiYWNrc1tcIiRcIit0XSx0aGlzO2Zvcih2YXIgcixvPTA7bzxuLmxlbmd0aDtvKyspaWYocj1uW29dLHI9PT1lfHxyLmZuPT09ZSl7bi5zcGxpY2UobywxKTticmVha31yZXR1cm4gdGhpc30sci5wcm90b3R5cGUuZW1pdD1mdW5jdGlvbih0KXt0aGlzLl9jYWxsYmFja3M9dGhpcy5fY2FsbGJhY2tzfHx7fTt2YXIgZT1bXS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKSxuPXRoaXMuX2NhbGxiYWNrc1tcIiRcIit0XTtpZihuKXtuPW4uc2xpY2UoMCk7Zm9yKHZhciByPTAsbz1uLmxlbmd0aDtyPG87KytyKW5bcl0uYXBwbHkodGhpcyxlKX1yZXR1cm4gdGhpc30sci5wcm90b3R5cGUubGlzdGVuZXJzPWZ1bmN0aW9uKHQpe3JldHVybiB0aGlzLl9jYWxsYmFja3M9dGhpcy5fY2FsbGJhY2tzfHx7fSx0aGlzLl9jYWxsYmFja3NbXCIkXCIrdF18fFtdfSxyLnByb3RvdHlwZS5oYXNMaXN0ZW5lcnM9ZnVuY3Rpb24odCl7cmV0dXJuISF0aGlzLmxpc3RlbmVycyh0KS5sZW5ndGh9fSxmdW5jdGlvbih0LGUsbil7KGZ1bmN0aW9uKGUpe2Z1bmN0aW9uIHIodCl7aWYoIXR8fFwib2JqZWN0XCIhPXR5cGVvZiB0KXJldHVybiExO2lmKG8odCkpe2Zvcih2YXIgbj0wLGk9dC5sZW5ndGg7bjxpO24rKylpZihyKHRbbl0pKXJldHVybiEwO3JldHVybiExfWlmKFwiZnVuY3Rpb25cIj09dHlwZW9mIGUuQnVmZmVyJiZlLkJ1ZmZlci5pc0J1ZmZlciYmZS5CdWZmZXIuaXNCdWZmZXIodCl8fFwiZnVuY3Rpb25cIj09dHlwZW9mIGUuQXJyYXlCdWZmZXImJnQgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcnx8cyYmdCBpbnN0YW5jZW9mIEJsb2J8fGEmJnQgaW5zdGFuY2VvZiBGaWxlKXJldHVybiEwO2lmKHQudG9KU09OJiZcImZ1bmN0aW9uXCI9PXR5cGVvZiB0LnRvSlNPTiYmMT09PWFyZ3VtZW50cy5sZW5ndGgpcmV0dXJuIHIodC50b0pTT04oKSwhMCk7Zm9yKHZhciBjIGluIHQpaWYoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHQsYykmJnIodFtjXSkpcmV0dXJuITA7cmV0dXJuITF9dmFyIG89bigxMCksaT1PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLHM9XCJmdW5jdGlvblwiPT10eXBlb2YgZS5CbG9ifHxcIltvYmplY3QgQmxvYkNvbnN0cnVjdG9yXVwiPT09aS5jYWxsKGUuQmxvYiksYT1cImZ1bmN0aW9uXCI9PXR5cGVvZiBlLkZpbGV8fFwiW29iamVjdCBGaWxlQ29uc3RydWN0b3JdXCI9PT1pLmNhbGwoZS5GaWxlKTt0LmV4cG9ydHM9cn0pLmNhbGwoZSxmdW5jdGlvbigpe3JldHVybiB0aGlzfSgpKX0sZnVuY3Rpb24odCxlKXt2YXIgbj17fS50b1N0cmluZzt0LmV4cG9ydHM9QXJyYXkuaXNBcnJheXx8ZnVuY3Rpb24odCl7cmV0dXJuXCJbb2JqZWN0IEFycmF5XVwiPT1uLmNhbGwodCl9fSxmdW5jdGlvbih0LGUsbil7KGZ1bmN0aW9uKHQpe2Z1bmN0aW9uIHIodCxlKXtpZighdClyZXR1cm4gdDtpZihzKHQpKXt2YXIgbj17X3BsYWNlaG9sZGVyOiEwLG51bTplLmxlbmd0aH07cmV0dXJuIGUucHVzaCh0KSxufWlmKGkodCkpe2Zvcih2YXIgbz1uZXcgQXJyYXkodC5sZW5ndGgpLGE9MDthPHQubGVuZ3RoO2ErKylvW2FdPXIodFthXSxlKTtyZXR1cm4gb31pZihcIm9iamVjdFwiPT10eXBlb2YgdCYmISh0IGluc3RhbmNlb2YgRGF0ZSkpe3ZhciBvPXt9O2Zvcih2YXIgYyBpbiB0KW9bY109cih0W2NdLGUpO3JldHVybiBvfXJldHVybiB0fWZ1bmN0aW9uIG8odCxlKXtpZighdClyZXR1cm4gdDtpZih0JiZ0Ll9wbGFjZWhvbGRlcilyZXR1cm4gZVt0Lm51bV07aWYoaSh0KSlmb3IodmFyIG49MDtuPHQubGVuZ3RoO24rKyl0W25dPW8odFtuXSxlKTtlbHNlIGlmKFwib2JqZWN0XCI9PXR5cGVvZiB0KWZvcih2YXIgciBpbiB0KXRbcl09byh0W3JdLGUpO3JldHVybiB0fXZhciBpPW4oMTApLHM9bigxMiksYT1PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLGM9XCJmdW5jdGlvblwiPT10eXBlb2YgdC5CbG9ifHxcIltvYmplY3QgQmxvYkNvbnN0cnVjdG9yXVwiPT09YS5jYWxsKHQuQmxvYikscD1cImZ1bmN0aW9uXCI9PXR5cGVvZiB0LkZpbGV8fFwiW29iamVjdCBGaWxlQ29uc3RydWN0b3JdXCI9PT1hLmNhbGwodC5GaWxlKTtlLmRlY29uc3RydWN0UGFja2V0PWZ1bmN0aW9uKHQpe3ZhciBlPVtdLG49dC5kYXRhLG89dDtyZXR1cm4gby5kYXRhPXIobixlKSxvLmF0dGFjaG1lbnRzPWUubGVuZ3RoLHtwYWNrZXQ6byxidWZmZXJzOmV9fSxlLnJlY29uc3RydWN0UGFja2V0PWZ1bmN0aW9uKHQsZSl7cmV0dXJuIHQuZGF0YT1vKHQuZGF0YSxlKSx0LmF0dGFjaG1lbnRzPXZvaWQgMCx0fSxlLnJlbW92ZUJsb2JzPWZ1bmN0aW9uKHQsZSl7ZnVuY3Rpb24gbih0LGEsdSl7aWYoIXQpcmV0dXJuIHQ7aWYoYyYmdCBpbnN0YW5jZW9mIEJsb2J8fHAmJnQgaW5zdGFuY2VvZiBGaWxlKXtyKys7dmFyIGg9bmV3IEZpbGVSZWFkZXI7aC5vbmxvYWQ9ZnVuY3Rpb24oKXt1P3VbYV09dGhpcy5yZXN1bHQ6bz10aGlzLnJlc3VsdCwtLXJ8fGUobyl9LGgucmVhZEFzQXJyYXlCdWZmZXIodCl9ZWxzZSBpZihpKHQpKWZvcih2YXIgZj0wO2Y8dC5sZW5ndGg7ZisrKW4odFtmXSxmLHQpO2Vsc2UgaWYoXCJvYmplY3RcIj09dHlwZW9mIHQmJiFzKHQpKWZvcih2YXIgbCBpbiB0KW4odFtsXSxsLHQpfXZhciByPTAsbz10O24obykscnx8ZShvKX19KS5jYWxsKGUsZnVuY3Rpb24oKXtyZXR1cm4gdGhpc30oKSl9LGZ1bmN0aW9uKHQsZSl7KGZ1bmN0aW9uKGUpe2Z1bmN0aW9uIG4odCl7cmV0dXJuIGUuQnVmZmVyJiZlLkJ1ZmZlci5pc0J1ZmZlcih0KXx8ZS5BcnJheUJ1ZmZlciYmdCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyfXQuZXhwb3J0cz1ufSkuY2FsbChlLGZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9KCkpfSxmdW5jdGlvbih0LGUsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gcih0LGUpe2lmKCEodGhpcyBpbnN0YW5jZW9mIHIpKXJldHVybiBuZXcgcih0LGUpO3QmJlwib2JqZWN0XCI9PT0oXCJ1bmRlZmluZWRcIj09dHlwZW9mIHQ/XCJ1bmRlZmluZWRcIjpvKHQpKSYmKGU9dCx0PXZvaWQgMCksZT1lfHx7fSxlLnBhdGg9ZS5wYXRofHxcIi9zb2NrZXQuaW9cIix0aGlzLm5zcHM9e30sdGhpcy5zdWJzPVtdLHRoaXMub3B0cz1lLHRoaXMucmVjb25uZWN0aW9uKGUucmVjb25uZWN0aW9uIT09ITEpLHRoaXMucmVjb25uZWN0aW9uQXR0ZW1wdHMoZS5yZWNvbm5lY3Rpb25BdHRlbXB0c3x8MS8wKSx0aGlzLnJlY29ubmVjdGlvbkRlbGF5KGUucmVjb25uZWN0aW9uRGVsYXl8fDFlMyksdGhpcy5yZWNvbm5lY3Rpb25EZWxheU1heChlLnJlY29ubmVjdGlvbkRlbGF5TWF4fHw1ZTMpLHRoaXMucmFuZG9taXphdGlvbkZhY3RvcihlLnJhbmRvbWl6YXRpb25GYWN0b3J8fC41KSx0aGlzLmJhY2tvZmY9bmV3IGwoe21pbjp0aGlzLnJlY29ubmVjdGlvbkRlbGF5KCksbWF4OnRoaXMucmVjb25uZWN0aW9uRGVsYXlNYXgoKSxqaXR0ZXI6dGhpcy5yYW5kb21pemF0aW9uRmFjdG9yKCl9KSx0aGlzLnRpbWVvdXQobnVsbD09ZS50aW1lb3V0PzJlNDplLnRpbWVvdXQpLHRoaXMucmVhZHlTdGF0ZT1cImNsb3NlZFwiLHRoaXMudXJpPXQsdGhpcy5jb25uZWN0aW5nPVtdLHRoaXMubGFzdFBpbmc9bnVsbCx0aGlzLmVuY29kaW5nPSExLHRoaXMucGFja2V0QnVmZmVyPVtdO3ZhciBuPWUucGFyc2VyfHxjO3RoaXMuZW5jb2Rlcj1uZXcgbi5FbmNvZGVyLHRoaXMuZGVjb2Rlcj1uZXcgbi5EZWNvZGVyLHRoaXMuYXV0b0Nvbm5lY3Q9ZS5hdXRvQ29ubmVjdCE9PSExLHRoaXMuYXV0b0Nvbm5lY3QmJnRoaXMub3BlbigpfXZhciBvPVwiZnVuY3Rpb25cIj09dHlwZW9mIFN5bWJvbCYmXCJzeW1ib2xcIj09dHlwZW9mIFN5bWJvbC5pdGVyYXRvcj9mdW5jdGlvbih0KXtyZXR1cm4gdHlwZW9mIHR9OmZ1bmN0aW9uKHQpe3JldHVybiB0JiZcImZ1bmN0aW9uXCI9PXR5cGVvZiBTeW1ib2wmJnQuY29uc3RydWN0b3I9PT1TeW1ib2wmJnQhPT1TeW1ib2wucHJvdG90eXBlP1wic3ltYm9sXCI6dHlwZW9mIHR9LGk9bigxNCkscz1uKDM5KSxhPW4oOCksYz1uKDcpLHA9big0MSksdT1uKDQyKSxoPW4oMykoXCJzb2NrZXQuaW8tY2xpZW50Om1hbmFnZXJcIiksZj1uKDM3KSxsPW4oNDMpLGQ9T2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTt0LmV4cG9ydHM9cixyLnByb3RvdHlwZS5lbWl0QWxsPWZ1bmN0aW9uKCl7dGhpcy5lbWl0LmFwcGx5KHRoaXMsYXJndW1lbnRzKTtmb3IodmFyIHQgaW4gdGhpcy5uc3BzKWQuY2FsbCh0aGlzLm5zcHMsdCkmJnRoaXMubnNwc1t0XS5lbWl0LmFwcGx5KHRoaXMubnNwc1t0XSxhcmd1bWVudHMpfSxyLnByb3RvdHlwZS51cGRhdGVTb2NrZXRJZHM9ZnVuY3Rpb24oKXtmb3IodmFyIHQgaW4gdGhpcy5uc3BzKWQuY2FsbCh0aGlzLm5zcHMsdCkmJih0aGlzLm5zcHNbdF0uaWQ9dGhpcy5nZW5lcmF0ZUlkKHQpKX0sci5wcm90b3R5cGUuZ2VuZXJhdGVJZD1mdW5jdGlvbih0KXtyZXR1cm4oXCIvXCI9PT10P1wiXCI6dCtcIiNcIikrdGhpcy5lbmdpbmUuaWR9LGEoci5wcm90b3R5cGUpLHIucHJvdG90eXBlLnJlY29ubmVjdGlvbj1mdW5jdGlvbih0KXtyZXR1cm4gYXJndW1lbnRzLmxlbmd0aD8odGhpcy5fcmVjb25uZWN0aW9uPSEhdCx0aGlzKTp0aGlzLl9yZWNvbm5lY3Rpb259LHIucHJvdG90eXBlLnJlY29ubmVjdGlvbkF0dGVtcHRzPWZ1bmN0aW9uKHQpe3JldHVybiBhcmd1bWVudHMubGVuZ3RoPyh0aGlzLl9yZWNvbm5lY3Rpb25BdHRlbXB0cz10LHRoaXMpOnRoaXMuX3JlY29ubmVjdGlvbkF0dGVtcHRzfSxyLnByb3RvdHlwZS5yZWNvbm5lY3Rpb25EZWxheT1mdW5jdGlvbih0KXtyZXR1cm4gYXJndW1lbnRzLmxlbmd0aD8odGhpcy5fcmVjb25uZWN0aW9uRGVsYXk9dCx0aGlzLmJhY2tvZmYmJnRoaXMuYmFja29mZi5zZXRNaW4odCksdGhpcyk6dGhpcy5fcmVjb25uZWN0aW9uRGVsYXl9LHIucHJvdG90eXBlLnJhbmRvbWl6YXRpb25GYWN0b3I9ZnVuY3Rpb24odCl7cmV0dXJuIGFyZ3VtZW50cy5sZW5ndGg/KHRoaXMuX3JhbmRvbWl6YXRpb25GYWN0b3I9dCx0aGlzLmJhY2tvZmYmJnRoaXMuYmFja29mZi5zZXRKaXR0ZXIodCksdGhpcyk6dGhpcy5fcmFuZG9taXphdGlvbkZhY3Rvcn0sci5wcm90b3R5cGUucmVjb25uZWN0aW9uRGVsYXlNYXg9ZnVuY3Rpb24odCl7cmV0dXJuIGFyZ3VtZW50cy5sZW5ndGg/KHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5TWF4PXQsdGhpcy5iYWNrb2ZmJiZ0aGlzLmJhY2tvZmYuc2V0TWF4KHQpLHRoaXMpOnRoaXMuX3JlY29ubmVjdGlvbkRlbGF5TWF4fSxyLnByb3RvdHlwZS50aW1lb3V0PWZ1bmN0aW9uKHQpe3JldHVybiBhcmd1bWVudHMubGVuZ3RoPyh0aGlzLl90aW1lb3V0PXQsdGhpcyk6dGhpcy5fdGltZW91dH0sci5wcm90b3R5cGUubWF5YmVSZWNvbm5lY3RPbk9wZW49ZnVuY3Rpb24oKXshdGhpcy5yZWNvbm5lY3RpbmcmJnRoaXMuX3JlY29ubmVjdGlvbiYmMD09PXRoaXMuYmFja29mZi5hdHRlbXB0cyYmdGhpcy5yZWNvbm5lY3QoKX0sci5wcm90b3R5cGUub3Blbj1yLnByb3RvdHlwZS5jb25uZWN0PWZ1bmN0aW9uKHQsZSl7aWYoaChcInJlYWR5U3RhdGUgJXNcIix0aGlzLnJlYWR5U3RhdGUpLH50aGlzLnJlYWR5U3RhdGUuaW5kZXhPZihcIm9wZW5cIikpcmV0dXJuIHRoaXM7aChcIm9wZW5pbmcgJXNcIix0aGlzLnVyaSksdGhpcy5lbmdpbmU9aSh0aGlzLnVyaSx0aGlzLm9wdHMpO3ZhciBuPXRoaXMuZW5naW5lLHI9dGhpczt0aGlzLnJlYWR5U3RhdGU9XCJvcGVuaW5nXCIsdGhpcy5za2lwUmVjb25uZWN0PSExO3ZhciBvPXAobixcIm9wZW5cIixmdW5jdGlvbigpe3Iub25vcGVuKCksdCYmdCgpfSkscz1wKG4sXCJlcnJvclwiLGZ1bmN0aW9uKGUpe2lmKGgoXCJjb25uZWN0X2Vycm9yXCIpLHIuY2xlYW51cCgpLHIucmVhZHlTdGF0ZT1cImNsb3NlZFwiLHIuZW1pdEFsbChcImNvbm5lY3RfZXJyb3JcIixlKSx0KXt2YXIgbj1uZXcgRXJyb3IoXCJDb25uZWN0aW9uIGVycm9yXCIpO24uZGF0YT1lLHQobil9ZWxzZSByLm1heWJlUmVjb25uZWN0T25PcGVuKCl9KTtpZighMSE9PXRoaXMuX3RpbWVvdXQpe3ZhciBhPXRoaXMuX3RpbWVvdXQ7aChcImNvbm5lY3QgYXR0ZW1wdCB3aWxsIHRpbWVvdXQgYWZ0ZXIgJWRcIixhKTt2YXIgYz1zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7aChcImNvbm5lY3QgYXR0ZW1wdCB0aW1lZCBvdXQgYWZ0ZXIgJWRcIixhKSxvLmRlc3Ryb3koKSxuLmNsb3NlKCksbi5lbWl0KFwiZXJyb3JcIixcInRpbWVvdXRcIiksci5lbWl0QWxsKFwiY29ubmVjdF90aW1lb3V0XCIsYSl9LGEpO3RoaXMuc3Vicy5wdXNoKHtkZXN0cm95OmZ1bmN0aW9uKCl7Y2xlYXJUaW1lb3V0KGMpfX0pfXJldHVybiB0aGlzLnN1YnMucHVzaChvKSx0aGlzLnN1YnMucHVzaChzKSx0aGlzfSxyLnByb3RvdHlwZS5vbm9wZW49ZnVuY3Rpb24oKXtoKFwib3BlblwiKSx0aGlzLmNsZWFudXAoKSx0aGlzLnJlYWR5U3RhdGU9XCJvcGVuXCIsdGhpcy5lbWl0KFwib3BlblwiKTt2YXIgdD10aGlzLmVuZ2luZTt0aGlzLnN1YnMucHVzaChwKHQsXCJkYXRhXCIsdSh0aGlzLFwib25kYXRhXCIpKSksdGhpcy5zdWJzLnB1c2gocCh0LFwicGluZ1wiLHUodGhpcyxcIm9ucGluZ1wiKSkpLHRoaXMuc3Vicy5wdXNoKHAodCxcInBvbmdcIix1KHRoaXMsXCJvbnBvbmdcIikpKSx0aGlzLnN1YnMucHVzaChwKHQsXCJlcnJvclwiLHUodGhpcyxcIm9uZXJyb3JcIikpKSx0aGlzLnN1YnMucHVzaChwKHQsXCJjbG9zZVwiLHUodGhpcyxcIm9uY2xvc2VcIikpKSx0aGlzLnN1YnMucHVzaChwKHRoaXMuZGVjb2RlcixcImRlY29kZWRcIix1KHRoaXMsXCJvbmRlY29kZWRcIikpKX0sci5wcm90b3R5cGUub25waW5nPWZ1bmN0aW9uKCl7dGhpcy5sYXN0UGluZz1uZXcgRGF0ZSx0aGlzLmVtaXRBbGwoXCJwaW5nXCIpfSxyLnByb3RvdHlwZS5vbnBvbmc9ZnVuY3Rpb24oKXt0aGlzLmVtaXRBbGwoXCJwb25nXCIsbmV3IERhdGUtdGhpcy5sYXN0UGluZyl9LHIucHJvdG90eXBlLm9uZGF0YT1mdW5jdGlvbih0KXt0aGlzLmRlY29kZXIuYWRkKHQpfSxyLnByb3RvdHlwZS5vbmRlY29kZWQ9ZnVuY3Rpb24odCl7dGhpcy5lbWl0KFwicGFja2V0XCIsdCl9LHIucHJvdG90eXBlLm9uZXJyb3I9ZnVuY3Rpb24odCl7aChcImVycm9yXCIsdCksdGhpcy5lbWl0QWxsKFwiZXJyb3JcIix0KX0sci5wcm90b3R5cGUuc29ja2V0PWZ1bmN0aW9uKHQsZSl7ZnVuY3Rpb24gbigpe35mKG8uY29ubmVjdGluZyxyKXx8by5jb25uZWN0aW5nLnB1c2gocil9dmFyIHI9dGhpcy5uc3BzW3RdO2lmKCFyKXtyPW5ldyBzKHRoaXMsdCxlKSx0aGlzLm5zcHNbdF09cjt2YXIgbz10aGlzO3Iub24oXCJjb25uZWN0aW5nXCIsbiksci5vbihcImNvbm5lY3RcIixmdW5jdGlvbigpe3IuaWQ9by5nZW5lcmF0ZUlkKHQpfSksdGhpcy5hdXRvQ29ubmVjdCYmbigpfXJldHVybiByfSxyLnByb3RvdHlwZS5kZXN0cm95PWZ1bmN0aW9uKHQpe3ZhciBlPWYodGhpcy5jb25uZWN0aW5nLHQpO35lJiZ0aGlzLmNvbm5lY3Rpbmcuc3BsaWNlKGUsMSksdGhpcy5jb25uZWN0aW5nLmxlbmd0aHx8dGhpcy5jbG9zZSgpfSxyLnByb3RvdHlwZS5wYWNrZXQ9ZnVuY3Rpb24odCl7aChcIndyaXRpbmcgcGFja2V0ICVqXCIsdCk7dmFyIGU9dGhpczt0LnF1ZXJ5JiYwPT09dC50eXBlJiYodC5uc3ArPVwiP1wiK3QucXVlcnkpLGUuZW5jb2Rpbmc/ZS5wYWNrZXRCdWZmZXIucHVzaCh0KTooZS5lbmNvZGluZz0hMCx0aGlzLmVuY29kZXIuZW5jb2RlKHQsZnVuY3Rpb24obil7Zm9yKHZhciByPTA7cjxuLmxlbmd0aDtyKyspZS5lbmdpbmUud3JpdGUobltyXSx0Lm9wdGlvbnMpO2UuZW5jb2Rpbmc9ITEsZS5wcm9jZXNzUGFja2V0UXVldWUoKX0pKX0sci5wcm90b3R5cGUucHJvY2Vzc1BhY2tldFF1ZXVlPWZ1bmN0aW9uKCl7aWYodGhpcy5wYWNrZXRCdWZmZXIubGVuZ3RoPjAmJiF0aGlzLmVuY29kaW5nKXt2YXIgdD10aGlzLnBhY2tldEJ1ZmZlci5zaGlmdCgpO3RoaXMucGFja2V0KHQpfX0sci5wcm90b3R5cGUuY2xlYW51cD1mdW5jdGlvbigpe2goXCJjbGVhbnVwXCIpO2Zvcih2YXIgdD10aGlzLnN1YnMubGVuZ3RoLGU9MDtlPHQ7ZSsrKXt2YXIgbj10aGlzLnN1YnMuc2hpZnQoKTtuLmRlc3Ryb3koKX10aGlzLnBhY2tldEJ1ZmZlcj1bXSx0aGlzLmVuY29kaW5nPSExLHRoaXMubGFzdFBpbmc9bnVsbCx0aGlzLmRlY29kZXIuZGVzdHJveSgpfSxyLnByb3RvdHlwZS5jbG9zZT1yLnByb3RvdHlwZS5kaXNjb25uZWN0PWZ1bmN0aW9uKCl7aChcImRpc2Nvbm5lY3RcIiksdGhpcy5za2lwUmVjb25uZWN0PSEwLHRoaXMucmVjb25uZWN0aW5nPSExLFwib3BlbmluZ1wiPT09dGhpcy5yZWFkeVN0YXRlJiZ0aGlzLmNsZWFudXAoKSx0aGlzLmJhY2tvZmYucmVzZXQoKSx0aGlzLnJlYWR5U3RhdGU9XCJjbG9zZWRcIix0aGlzLmVuZ2luZSYmdGhpcy5lbmdpbmUuY2xvc2UoKX0sci5wcm90b3R5cGUub25jbG9zZT1mdW5jdGlvbih0KXtoKFwib25jbG9zZVwiKSx0aGlzLmNsZWFudXAoKSx0aGlzLmJhY2tvZmYucmVzZXQoKSx0aGlzLnJlYWR5U3RhdGU9XCJjbG9zZWRcIix0aGlzLmVtaXQoXCJjbG9zZVwiLHQpLHRoaXMuX3JlY29ubmVjdGlvbiYmIXRoaXMuc2tpcFJlY29ubmVjdCYmdGhpcy5yZWNvbm5lY3QoKX0sci5wcm90b3R5cGUucmVjb25uZWN0PWZ1bmN0aW9uKCl7aWYodGhpcy5yZWNvbm5lY3Rpbmd8fHRoaXMuc2tpcFJlY29ubmVjdClyZXR1cm4gdGhpczt2YXIgdD10aGlzO2lmKHRoaXMuYmFja29mZi5hdHRlbXB0cz49dGhpcy5fcmVjb25uZWN0aW9uQXR0ZW1wdHMpaChcInJlY29ubmVjdCBmYWlsZWRcIiksdGhpcy5iYWNrb2ZmLnJlc2V0KCksdGhpcy5lbWl0QWxsKFwicmVjb25uZWN0X2ZhaWxlZFwiKSx0aGlzLnJlY29ubmVjdGluZz0hMTtlbHNle3ZhciBlPXRoaXMuYmFja29mZi5kdXJhdGlvbigpO2goXCJ3aWxsIHdhaXQgJWRtcyBiZWZvcmUgcmVjb25uZWN0IGF0dGVtcHRcIixlKSx0aGlzLnJlY29ubmVjdGluZz0hMDt2YXIgbj1zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7dC5za2lwUmVjb25uZWN0fHwoaChcImF0dGVtcHRpbmcgcmVjb25uZWN0XCIpLHQuZW1pdEFsbChcInJlY29ubmVjdF9hdHRlbXB0XCIsdC5iYWNrb2ZmLmF0dGVtcHRzKSx0LmVtaXRBbGwoXCJyZWNvbm5lY3RpbmdcIix0LmJhY2tvZmYuYXR0ZW1wdHMpLHQuc2tpcFJlY29ubmVjdHx8dC5vcGVuKGZ1bmN0aW9uKGUpe2U/KGgoXCJyZWNvbm5lY3QgYXR0ZW1wdCBlcnJvclwiKSx0LnJlY29ubmVjdGluZz0hMSx0LnJlY29ubmVjdCgpLHQuZW1pdEFsbChcInJlY29ubmVjdF9lcnJvclwiLGUuZGF0YSkpOihoKFwicmVjb25uZWN0IHN1Y2Nlc3NcIiksdC5vbnJlY29ubmVjdCgpKX0pKX0sZSk7dGhpcy5zdWJzLnB1c2goe2Rlc3Ryb3k6ZnVuY3Rpb24oKXtjbGVhclRpbWVvdXQobil9fSl9fSxyLnByb3RvdHlwZS5vbnJlY29ubmVjdD1mdW5jdGlvbigpe3ZhciB0PXRoaXMuYmFja29mZi5hdHRlbXB0czt0aGlzLnJlY29ubmVjdGluZz0hMSx0aGlzLmJhY2tvZmYucmVzZXQoKSx0aGlzLnVwZGF0ZVNvY2tldElkcygpLHRoaXMuZW1pdEFsbChcInJlY29ubmVjdFwiLHQpfX0sZnVuY3Rpb24odCxlLG4pe3QuZXhwb3J0cz1uKDE1KX0sZnVuY3Rpb24odCxlLG4pe3QuZXhwb3J0cz1uKDE2KSx0LmV4cG9ydHMucGFyc2VyPW4oMjMpfSxmdW5jdGlvbih0LGUsbil7KGZ1bmN0aW9uKGUpe2Z1bmN0aW9uIHIodCxuKXtpZighKHRoaXMgaW5zdGFuY2VvZiByKSlyZXR1cm4gbmV3IHIodCxuKTtuPW58fHt9LHQmJlwib2JqZWN0XCI9PXR5cGVvZiB0JiYobj10LHQ9bnVsbCksdD8odD11KHQpLG4uaG9zdG5hbWU9dC5ob3N0LG4uc2VjdXJlPVwiaHR0cHNcIj09PXQucHJvdG9jb2x8fFwid3NzXCI9PT10LnByb3RvY29sLG4ucG9ydD10LnBvcnQsdC5xdWVyeSYmKG4ucXVlcnk9dC5xdWVyeSkpOm4uaG9zdCYmKG4uaG9zdG5hbWU9dShuLmhvc3QpLmhvc3QpLHRoaXMuc2VjdXJlPW51bGwhPW4uc2VjdXJlP24uc2VjdXJlOmUubG9jYXRpb24mJlwiaHR0cHM6XCI9PT1sb2NhdGlvbi5wcm90b2NvbCxuLmhvc3RuYW1lJiYhbi5wb3J0JiYobi5wb3J0PXRoaXMuc2VjdXJlP1wiNDQzXCI6XCI4MFwiKSx0aGlzLmFnZW50PW4uYWdlbnR8fCExLHRoaXMuaG9zdG5hbWU9bi5ob3N0bmFtZXx8KGUubG9jYXRpb24/bG9jYXRpb24uaG9zdG5hbWU6XCJsb2NhbGhvc3RcIiksdGhpcy5wb3J0PW4ucG9ydHx8KGUubG9jYXRpb24mJmxvY2F0aW9uLnBvcnQ/bG9jYXRpb24ucG9ydDp0aGlzLnNlY3VyZT80NDM6ODApLHRoaXMucXVlcnk9bi5xdWVyeXx8e30sXCJzdHJpbmdcIj09dHlwZW9mIHRoaXMucXVlcnkmJih0aGlzLnF1ZXJ5PWYuZGVjb2RlKHRoaXMucXVlcnkpKSx0aGlzLnVwZ3JhZGU9ITEhPT1uLnVwZ3JhZGUsdGhpcy5wYXRoPShuLnBhdGh8fFwiL2VuZ2luZS5pb1wiKS5yZXBsYWNlKC9cXC8kLyxcIlwiKStcIi9cIix0aGlzLmZvcmNlSlNPTlA9ISFuLmZvcmNlSlNPTlAsdGhpcy5qc29ucD0hMSE9PW4uanNvbnAsdGhpcy5mb3JjZUJhc2U2ND0hIW4uZm9yY2VCYXNlNjQsdGhpcy5lbmFibGVzWERSPSEhbi5lbmFibGVzWERSLHRoaXMudGltZXN0YW1wUGFyYW09bi50aW1lc3RhbXBQYXJhbXx8XCJ0XCIsdGhpcy50aW1lc3RhbXBSZXF1ZXN0cz1uLnRpbWVzdGFtcFJlcXVlc3RzLHRoaXMudHJhbnNwb3J0cz1uLnRyYW5zcG9ydHN8fFtcInBvbGxpbmdcIixcIndlYnNvY2tldFwiXSx0aGlzLnRyYW5zcG9ydE9wdGlvbnM9bi50cmFuc3BvcnRPcHRpb25zfHx7fSx0aGlzLnJlYWR5U3RhdGU9XCJcIix0aGlzLndyaXRlQnVmZmVyPVtdLHRoaXMucHJldkJ1ZmZlckxlbj0wLHRoaXMucG9saWN5UG9ydD1uLnBvbGljeVBvcnR8fDg0Myx0aGlzLnJlbWVtYmVyVXBncmFkZT1uLnJlbWVtYmVyVXBncmFkZXx8ITEsdGhpcy5iaW5hcnlUeXBlPW51bGwsdGhpcy5vbmx5QmluYXJ5VXBncmFkZXM9bi5vbmx5QmluYXJ5VXBncmFkZXMsdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZT0hMSE9PW4ucGVyTWVzc2FnZURlZmxhdGUmJihuLnBlck1lc3NhZ2VEZWZsYXRlfHx7fSksITA9PT10aGlzLnBlck1lc3NhZ2VEZWZsYXRlJiYodGhpcy5wZXJNZXNzYWdlRGVmbGF0ZT17fSksdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZSYmbnVsbD09dGhpcy5wZXJNZXNzYWdlRGVmbGF0ZS50aHJlc2hvbGQmJih0aGlzLnBlck1lc3NhZ2VEZWZsYXRlLnRocmVzaG9sZD0xMDI0KSx0aGlzLnBmeD1uLnBmeHx8bnVsbCx0aGlzLmtleT1uLmtleXx8bnVsbCx0aGlzLnBhc3NwaHJhc2U9bi5wYXNzcGhyYXNlfHxudWxsLHRoaXMuY2VydD1uLmNlcnR8fG51bGwsdGhpcy5jYT1uLmNhfHxudWxsLHRoaXMuY2lwaGVycz1uLmNpcGhlcnN8fG51bGwsdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQ9dm9pZCAwPT09bi5yZWplY3RVbmF1dGhvcml6ZWR8fG4ucmVqZWN0VW5hdXRob3JpemVkLHRoaXMuZm9yY2VOb2RlPSEhbi5mb3JjZU5vZGU7dmFyIG89XCJvYmplY3RcIj09dHlwZW9mIGUmJmU7by5nbG9iYWw9PT1vJiYobi5leHRyYUhlYWRlcnMmJk9iamVjdC5rZXlzKG4uZXh0cmFIZWFkZXJzKS5sZW5ndGg+MCYmKHRoaXMuZXh0cmFIZWFkZXJzPW4uZXh0cmFIZWFkZXJzKSxuLmxvY2FsQWRkcmVzcyYmKHRoaXMubG9jYWxBZGRyZXNzPW4ubG9jYWxBZGRyZXNzKSksdGhpcy5pZD1udWxsLHRoaXMudXBncmFkZXM9bnVsbCx0aGlzLnBpbmdJbnRlcnZhbD1udWxsLHRoaXMucGluZ1RpbWVvdXQ9bnVsbCx0aGlzLnBpbmdJbnRlcnZhbFRpbWVyPW51bGwsdGhpcy5waW5nVGltZW91dFRpbWVyPW51bGwsdGhpcy5vcGVuKCl9ZnVuY3Rpb24gbyh0KXt2YXIgZT17fTtmb3IodmFyIG4gaW4gdCl0Lmhhc093blByb3BlcnR5KG4pJiYoZVtuXT10W25dKTtyZXR1cm4gZX12YXIgaT1uKDE3KSxzPW4oOCksYT1uKDMpKFwiZW5naW5lLmlvLWNsaWVudDpzb2NrZXRcIiksYz1uKDM3KSxwPW4oMjMpLHU9bigyKSxoPW4oMzgpLGY9bigzMSk7dC5leHBvcnRzPXIsci5wcmlvcldlYnNvY2tldFN1Y2Nlc3M9ITEscyhyLnByb3RvdHlwZSksci5wcm90b2NvbD1wLnByb3RvY29sLHIuU29ja2V0PXIsci5UcmFuc3BvcnQ9bigyMiksci50cmFuc3BvcnRzPW4oMTcpLHIucGFyc2VyPW4oMjMpLHIucHJvdG90eXBlLmNyZWF0ZVRyYW5zcG9ydD1mdW5jdGlvbih0KXthKCdjcmVhdGluZyB0cmFuc3BvcnQgXCIlc1wiJyx0KTt2YXIgZT1vKHRoaXMucXVlcnkpO2UuRUlPPXAucHJvdG9jb2wsZS50cmFuc3BvcnQ9dDt2YXIgbj10aGlzLnRyYW5zcG9ydE9wdGlvbnNbdF18fHt9O3RoaXMuaWQmJihlLnNpZD10aGlzLmlkKTt2YXIgcj1uZXcgaVt0XSh7cXVlcnk6ZSxzb2NrZXQ6dGhpcyxhZ2VudDpuLmFnZW50fHx0aGlzLmFnZW50LGhvc3RuYW1lOm4uaG9zdG5hbWV8fHRoaXMuaG9zdG5hbWUscG9ydDpuLnBvcnR8fHRoaXMucG9ydCxzZWN1cmU6bi5zZWN1cmV8fHRoaXMuc2VjdXJlLHBhdGg6bi5wYXRofHx0aGlzLnBhdGgsZm9yY2VKU09OUDpuLmZvcmNlSlNPTlB8fHRoaXMuZm9yY2VKU09OUCxqc29ucDpuLmpzb25wfHx0aGlzLmpzb25wLGZvcmNlQmFzZTY0Om4uZm9yY2VCYXNlNjR8fHRoaXMuZm9yY2VCYXNlNjQsZW5hYmxlc1hEUjpuLmVuYWJsZXNYRFJ8fHRoaXMuZW5hYmxlc1hEUix0aW1lc3RhbXBSZXF1ZXN0czpuLnRpbWVzdGFtcFJlcXVlc3RzfHx0aGlzLnRpbWVzdGFtcFJlcXVlc3RzLHRpbWVzdGFtcFBhcmFtOm4udGltZXN0YW1wUGFyYW18fHRoaXMudGltZXN0YW1wUGFyYW0scG9saWN5UG9ydDpuLnBvbGljeVBvcnR8fHRoaXMucG9saWN5UG9ydCxwZng6bi5wZnh8fHRoaXMucGZ4LGtleTpuLmtleXx8dGhpcy5rZXkscGFzc3BocmFzZTpuLnBhc3NwaHJhc2V8fHRoaXMucGFzc3BocmFzZSxjZXJ0Om4uY2VydHx8dGhpcy5jZXJ0LGNhOm4uY2F8fHRoaXMuY2EsY2lwaGVyczpuLmNpcGhlcnN8fHRoaXMuY2lwaGVycyxyZWplY3RVbmF1dGhvcml6ZWQ6bi5yZWplY3RVbmF1dGhvcml6ZWR8fHRoaXMucmVqZWN0VW5hdXRob3JpemVkLHBlck1lc3NhZ2VEZWZsYXRlOm4ucGVyTWVzc2FnZURlZmxhdGV8fHRoaXMucGVyTWVzc2FnZURlZmxhdGUsZXh0cmFIZWFkZXJzOm4uZXh0cmFIZWFkZXJzfHx0aGlzLmV4dHJhSGVhZGVycyxmb3JjZU5vZGU6bi5mb3JjZU5vZGV8fHRoaXMuZm9yY2VOb2RlLGxvY2FsQWRkcmVzczpuLmxvY2FsQWRkcmVzc3x8dGhpcy5sb2NhbEFkZHJlc3MscmVxdWVzdFRpbWVvdXQ6bi5yZXF1ZXN0VGltZW91dHx8dGhpcy5yZXF1ZXN0VGltZW91dCxwcm90b2NvbHM6bi5wcm90b2NvbHN8fHZvaWQgMH0pO3JldHVybiByfSxyLnByb3RvdHlwZS5vcGVuPWZ1bmN0aW9uKCl7dmFyIHQ7aWYodGhpcy5yZW1lbWJlclVwZ3JhZGUmJnIucHJpb3JXZWJzb2NrZXRTdWNjZXNzJiZ0aGlzLnRyYW5zcG9ydHMuaW5kZXhPZihcIndlYnNvY2tldFwiKSE9PS0xKXQ9XCJ3ZWJzb2NrZXRcIjtlbHNle2lmKDA9PT10aGlzLnRyYW5zcG9ydHMubGVuZ3RoKXt2YXIgZT10aGlzO3JldHVybiB2b2lkIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtlLmVtaXQoXCJlcnJvclwiLFwiTm8gdHJhbnNwb3J0cyBhdmFpbGFibGVcIil9LDApfXQ9dGhpcy50cmFuc3BvcnRzWzBdfXRoaXMucmVhZHlTdGF0ZT1cIm9wZW5pbmdcIjt0cnl7dD10aGlzLmNyZWF0ZVRyYW5zcG9ydCh0KX1jYXRjaChuKXtyZXR1cm4gdGhpcy50cmFuc3BvcnRzLnNoaWZ0KCksdm9pZCB0aGlzLm9wZW4oKX10Lm9wZW4oKSx0aGlzLnNldFRyYW5zcG9ydCh0KX0sci5wcm90b3R5cGUuc2V0VHJhbnNwb3J0PWZ1bmN0aW9uKHQpe2EoXCJzZXR0aW5nIHRyYW5zcG9ydCAlc1wiLHQubmFtZSk7dmFyIGU9dGhpczt0aGlzLnRyYW5zcG9ydCYmKGEoXCJjbGVhcmluZyBleGlzdGluZyB0cmFuc3BvcnQgJXNcIix0aGlzLnRyYW5zcG9ydC5uYW1lKSx0aGlzLnRyYW5zcG9ydC5yZW1vdmVBbGxMaXN0ZW5lcnMoKSksdGhpcy50cmFuc3BvcnQ9dCx0Lm9uKFwiZHJhaW5cIixmdW5jdGlvbigpe2Uub25EcmFpbigpfSkub24oXCJwYWNrZXRcIixmdW5jdGlvbih0KXtlLm9uUGFja2V0KHQpfSkub24oXCJlcnJvclwiLGZ1bmN0aW9uKHQpe2Uub25FcnJvcih0KX0pLm9uKFwiY2xvc2VcIixmdW5jdGlvbigpe2Uub25DbG9zZShcInRyYW5zcG9ydCBjbG9zZVwiKX0pfSxyLnByb3RvdHlwZS5wcm9iZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKCl7aWYoZi5vbmx5QmluYXJ5VXBncmFkZXMpe3ZhciBlPSF0aGlzLnN1cHBvcnRzQmluYXJ5JiZmLnRyYW5zcG9ydC5zdXBwb3J0c0JpbmFyeTtoPWh8fGV9aHx8KGEoJ3Byb2JlIHRyYW5zcG9ydCBcIiVzXCIgb3BlbmVkJyx0KSx1LnNlbmQoW3t0eXBlOlwicGluZ1wiLGRhdGE6XCJwcm9iZVwifV0pLHUub25jZShcInBhY2tldFwiLGZ1bmN0aW9uKGUpe2lmKCFoKWlmKFwicG9uZ1wiPT09ZS50eXBlJiZcInByb2JlXCI9PT1lLmRhdGEpe2lmKGEoJ3Byb2JlIHRyYW5zcG9ydCBcIiVzXCIgcG9uZycsdCksZi51cGdyYWRpbmc9ITAsZi5lbWl0KFwidXBncmFkaW5nXCIsdSksIXUpcmV0dXJuO3IucHJpb3JXZWJzb2NrZXRTdWNjZXNzPVwid2Vic29ja2V0XCI9PT11Lm5hbWUsYSgncGF1c2luZyBjdXJyZW50IHRyYW5zcG9ydCBcIiVzXCInLGYudHJhbnNwb3J0Lm5hbWUpLGYudHJhbnNwb3J0LnBhdXNlKGZ1bmN0aW9uKCl7aHx8XCJjbG9zZWRcIiE9PWYucmVhZHlTdGF0ZSYmKGEoXCJjaGFuZ2luZyB0cmFuc3BvcnQgYW5kIHNlbmRpbmcgdXBncmFkZSBwYWNrZXRcIikscCgpLGYuc2V0VHJhbnNwb3J0KHUpLHUuc2VuZChbe3R5cGU6XCJ1cGdyYWRlXCJ9XSksZi5lbWl0KFwidXBncmFkZVwiLHUpLHU9bnVsbCxmLnVwZ3JhZGluZz0hMSxmLmZsdXNoKCkpfSl9ZWxzZXthKCdwcm9iZSB0cmFuc3BvcnQgXCIlc1wiIGZhaWxlZCcsdCk7dmFyIG49bmV3IEVycm9yKFwicHJvYmUgZXJyb3JcIik7bi50cmFuc3BvcnQ9dS5uYW1lLGYuZW1pdChcInVwZ3JhZGVFcnJvclwiLG4pfX0pKX1mdW5jdGlvbiBuKCl7aHx8KGg9ITAscCgpLHUuY2xvc2UoKSx1PW51bGwpfWZ1bmN0aW9uIG8oZSl7dmFyIHI9bmV3IEVycm9yKFwicHJvYmUgZXJyb3I6IFwiK2UpO3IudHJhbnNwb3J0PXUubmFtZSxuKCksYSgncHJvYmUgdHJhbnNwb3J0IFwiJXNcIiBmYWlsZWQgYmVjYXVzZSBvZiBlcnJvcjogJXMnLHQsZSksZi5lbWl0KFwidXBncmFkZUVycm9yXCIscil9ZnVuY3Rpb24gaSgpe28oXCJ0cmFuc3BvcnQgY2xvc2VkXCIpfWZ1bmN0aW9uIHMoKXtvKFwic29ja2V0IGNsb3NlZFwiKX1mdW5jdGlvbiBjKHQpe3UmJnQubmFtZSE9PXUubmFtZSYmKGEoJ1wiJXNcIiB3b3JrcyAtIGFib3J0aW5nIFwiJXNcIicsdC5uYW1lLHUubmFtZSksbigpKX1mdW5jdGlvbiBwKCl7dS5yZW1vdmVMaXN0ZW5lcihcIm9wZW5cIixlKSx1LnJlbW92ZUxpc3RlbmVyKFwiZXJyb3JcIixvKSx1LnJlbW92ZUxpc3RlbmVyKFwiY2xvc2VcIixpKSxmLnJlbW92ZUxpc3RlbmVyKFwiY2xvc2VcIixzKSxmLnJlbW92ZUxpc3RlbmVyKFwidXBncmFkaW5nXCIsYyl9YSgncHJvYmluZyB0cmFuc3BvcnQgXCIlc1wiJyx0KTt2YXIgdT10aGlzLmNyZWF0ZVRyYW5zcG9ydCh0LHtwcm9iZToxfSksaD0hMSxmPXRoaXM7ci5wcmlvcldlYnNvY2tldFN1Y2Nlc3M9ITEsdS5vbmNlKFwib3BlblwiLGUpLHUub25jZShcImVycm9yXCIsbyksdS5vbmNlKFwiY2xvc2VcIixpKSx0aGlzLm9uY2UoXCJjbG9zZVwiLHMpLHRoaXMub25jZShcInVwZ3JhZGluZ1wiLGMpLHUub3BlbigpfSxyLnByb3RvdHlwZS5vbk9wZW49ZnVuY3Rpb24oKXtpZihhKFwic29ja2V0IG9wZW5cIiksdGhpcy5yZWFkeVN0YXRlPVwib3BlblwiLHIucHJpb3JXZWJzb2NrZXRTdWNjZXNzPVwid2Vic29ja2V0XCI9PT10aGlzLnRyYW5zcG9ydC5uYW1lLHRoaXMuZW1pdChcIm9wZW5cIiksdGhpcy5mbHVzaCgpLFwib3BlblwiPT09dGhpcy5yZWFkeVN0YXRlJiZ0aGlzLnVwZ3JhZGUmJnRoaXMudHJhbnNwb3J0LnBhdXNlKXthKFwic3RhcnRpbmcgdXBncmFkZSBwcm9iZXNcIik7Zm9yKHZhciB0PTAsZT10aGlzLnVwZ3JhZGVzLmxlbmd0aDt0PGU7dCsrKXRoaXMucHJvYmUodGhpcy51cGdyYWRlc1t0XSl9fSxyLnByb3RvdHlwZS5vblBhY2tldD1mdW5jdGlvbih0KXtpZihcIm9wZW5pbmdcIj09PXRoaXMucmVhZHlTdGF0ZXx8XCJvcGVuXCI9PT10aGlzLnJlYWR5U3RhdGV8fFwiY2xvc2luZ1wiPT09dGhpcy5yZWFkeVN0YXRlKXN3aXRjaChhKCdzb2NrZXQgcmVjZWl2ZTogdHlwZSBcIiVzXCIsIGRhdGEgXCIlc1wiJyx0LnR5cGUsdC5kYXRhKSx0aGlzLmVtaXQoXCJwYWNrZXRcIix0KSx0aGlzLmVtaXQoXCJoZWFydGJlYXRcIiksdC50eXBlKXtjYXNlXCJvcGVuXCI6dGhpcy5vbkhhbmRzaGFrZShoKHQuZGF0YSkpO2JyZWFrO2Nhc2VcInBvbmdcIjp0aGlzLnNldFBpbmcoKSx0aGlzLmVtaXQoXCJwb25nXCIpO2JyZWFrO2Nhc2VcImVycm9yXCI6dmFyIGU9bmV3IEVycm9yKFwic2VydmVyIGVycm9yXCIpO2UuY29kZT10LmRhdGEsdGhpcy5vbkVycm9yKGUpO2JyZWFrO2Nhc2VcIm1lc3NhZ2VcIjp0aGlzLmVtaXQoXCJkYXRhXCIsdC5kYXRhKSx0aGlzLmVtaXQoXCJtZXNzYWdlXCIsdC5kYXRhKX1lbHNlIGEoJ3BhY2tldCByZWNlaXZlZCB3aXRoIHNvY2tldCByZWFkeVN0YXRlIFwiJXNcIicsdGhpcy5yZWFkeVN0YXRlKX0sci5wcm90b3R5cGUub25IYW5kc2hha2U9ZnVuY3Rpb24odCl7dGhpcy5lbWl0KFwiaGFuZHNoYWtlXCIsdCksdGhpcy5pZD10LnNpZCx0aGlzLnRyYW5zcG9ydC5xdWVyeS5zaWQ9dC5zaWQsdGhpcy51cGdyYWRlcz10aGlzLmZpbHRlclVwZ3JhZGVzKHQudXBncmFkZXMpLHRoaXMucGluZ0ludGVydmFsPXQucGluZ0ludGVydmFsLHRoaXMucGluZ1RpbWVvdXQ9dC5waW5nVGltZW91dCx0aGlzLm9uT3BlbigpLFwiY2xvc2VkXCIhPT10aGlzLnJlYWR5U3RhdGUmJih0aGlzLnNldFBpbmcoKSx0aGlzLnJlbW92ZUxpc3RlbmVyKFwiaGVhcnRiZWF0XCIsdGhpcy5vbkhlYXJ0YmVhdCksdGhpcy5vbihcImhlYXJ0YmVhdFwiLHRoaXMub25IZWFydGJlYXQpKX0sci5wcm90b3R5cGUub25IZWFydGJlYXQ9ZnVuY3Rpb24odCl7Y2xlYXJUaW1lb3V0KHRoaXMucGluZ1RpbWVvdXRUaW1lcik7dmFyIGU9dGhpcztlLnBpbmdUaW1lb3V0VGltZXI9c2V0VGltZW91dChmdW5jdGlvbigpe1wiY2xvc2VkXCIhPT1lLnJlYWR5U3RhdGUmJmUub25DbG9zZShcInBpbmcgdGltZW91dFwiKX0sdHx8ZS5waW5nSW50ZXJ2YWwrZS5waW5nVGltZW91dCl9LHIucHJvdG90eXBlLnNldFBpbmc9ZnVuY3Rpb24oKXt2YXIgdD10aGlzO2NsZWFyVGltZW91dCh0LnBpbmdJbnRlcnZhbFRpbWVyKSx0LnBpbmdJbnRlcnZhbFRpbWVyPXNldFRpbWVvdXQoZnVuY3Rpb24oKXthKFwid3JpdGluZyBwaW5nIHBhY2tldCAtIGV4cGVjdGluZyBwb25nIHdpdGhpbiAlc21zXCIsdC5waW5nVGltZW91dCksdC5waW5nKCksdC5vbkhlYXJ0YmVhdCh0LnBpbmdUaW1lb3V0KX0sdC5waW5nSW50ZXJ2YWwpfSxyLnByb3RvdHlwZS5waW5nPWZ1bmN0aW9uKCl7dmFyIHQ9dGhpczt0aGlzLnNlbmRQYWNrZXQoXCJwaW5nXCIsZnVuY3Rpb24oKXt0LmVtaXQoXCJwaW5nXCIpfSl9LHIucHJvdG90eXBlLm9uRHJhaW49ZnVuY3Rpb24oKXt0aGlzLndyaXRlQnVmZmVyLnNwbGljZSgwLHRoaXMucHJldkJ1ZmZlckxlbiksdGhpcy5wcmV2QnVmZmVyTGVuPTAsMD09PXRoaXMud3JpdGVCdWZmZXIubGVuZ3RoP3RoaXMuZW1pdChcImRyYWluXCIpOnRoaXMuZmx1c2goKX0sci5wcm90b3R5cGUuZmx1c2g9ZnVuY3Rpb24oKXtcImNsb3NlZFwiIT09dGhpcy5yZWFkeVN0YXRlJiZ0aGlzLnRyYW5zcG9ydC53cml0YWJsZSYmIXRoaXMudXBncmFkaW5nJiZ0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCYmKGEoXCJmbHVzaGluZyAlZCBwYWNrZXRzIGluIHNvY2tldFwiLHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoKSx0aGlzLnRyYW5zcG9ydC5zZW5kKHRoaXMud3JpdGVCdWZmZXIpLHRoaXMucHJldkJ1ZmZlckxlbj10aGlzLndyaXRlQnVmZmVyLmxlbmd0aCx0aGlzLmVtaXQoXCJmbHVzaFwiKSl9LHIucHJvdG90eXBlLndyaXRlPXIucHJvdG90eXBlLnNlbmQ9ZnVuY3Rpb24odCxlLG4pe3JldHVybiB0aGlzLnNlbmRQYWNrZXQoXCJtZXNzYWdlXCIsdCxlLG4pLHRoaXN9LHIucHJvdG90eXBlLnNlbmRQYWNrZXQ9ZnVuY3Rpb24odCxlLG4scil7aWYoXCJmdW5jdGlvblwiPT10eXBlb2YgZSYmKHI9ZSxlPXZvaWQgMCksXCJmdW5jdGlvblwiPT10eXBlb2YgbiYmKHI9bixuPW51bGwpLFwiY2xvc2luZ1wiIT09dGhpcy5yZWFkeVN0YXRlJiZcImNsb3NlZFwiIT09dGhpcy5yZWFkeVN0YXRlKXtuPW58fHt9LG4uY29tcHJlc3M9ITEhPT1uLmNvbXByZXNzO3ZhciBvPXt0eXBlOnQsZGF0YTplLG9wdGlvbnM6bn07dGhpcy5lbWl0KFwicGFja2V0Q3JlYXRlXCIsbyksdGhpcy53cml0ZUJ1ZmZlci5wdXNoKG8pLHImJnRoaXMub25jZShcImZsdXNoXCIsciksdGhpcy5mbHVzaCgpfX0sci5wcm90b3R5cGUuY2xvc2U9ZnVuY3Rpb24oKXtmdW5jdGlvbiB0KCl7ci5vbkNsb3NlKFwiZm9yY2VkIGNsb3NlXCIpLGEoXCJzb2NrZXQgY2xvc2luZyAtIHRlbGxpbmcgdHJhbnNwb3J0IHRvIGNsb3NlXCIpLHIudHJhbnNwb3J0LmNsb3NlKCl9ZnVuY3Rpb24gZSgpe3IucmVtb3ZlTGlzdGVuZXIoXCJ1cGdyYWRlXCIsZSksci5yZW1vdmVMaXN0ZW5lcihcInVwZ3JhZGVFcnJvclwiLGUpLHQoKX1mdW5jdGlvbiBuKCl7ci5vbmNlKFwidXBncmFkZVwiLGUpLHIub25jZShcInVwZ3JhZGVFcnJvclwiLGUpfWlmKFwib3BlbmluZ1wiPT09dGhpcy5yZWFkeVN0YXRlfHxcIm9wZW5cIj09PXRoaXMucmVhZHlTdGF0ZSl7dGhpcy5yZWFkeVN0YXRlPVwiY2xvc2luZ1wiO3ZhciByPXRoaXM7dGhpcy53cml0ZUJ1ZmZlci5sZW5ndGg/dGhpcy5vbmNlKFwiZHJhaW5cIixmdW5jdGlvbigpe3RoaXMudXBncmFkaW5nP24oKTp0KCl9KTp0aGlzLnVwZ3JhZGluZz9uKCk6dCgpfXJldHVybiB0aGlzfSxyLnByb3RvdHlwZS5vbkVycm9yPWZ1bmN0aW9uKHQpe2EoXCJzb2NrZXQgZXJyb3IgJWpcIix0KSxyLnByaW9yV2Vic29ja2V0U3VjY2Vzcz0hMSx0aGlzLmVtaXQoXCJlcnJvclwiLHQpLHRoaXMub25DbG9zZShcInRyYW5zcG9ydCBlcnJvclwiLHQpfSxyLnByb3RvdHlwZS5vbkNsb3NlPWZ1bmN0aW9uKHQsZSl7aWYoXCJvcGVuaW5nXCI9PT10aGlzLnJlYWR5U3RhdGV8fFwib3BlblwiPT09dGhpcy5yZWFkeVN0YXRlfHxcImNsb3NpbmdcIj09PXRoaXMucmVhZHlTdGF0ZSl7YSgnc29ja2V0IGNsb3NlIHdpdGggcmVhc29uOiBcIiVzXCInLHQpO3ZhciBuPXRoaXM7Y2xlYXJUaW1lb3V0KHRoaXMucGluZ0ludGVydmFsVGltZXIpLGNsZWFyVGltZW91dCh0aGlzLnBpbmdUaW1lb3V0VGltZXIpLHRoaXMudHJhbnNwb3J0LnJlbW92ZUFsbExpc3RlbmVycyhcImNsb3NlXCIpLHRoaXMudHJhbnNwb3J0LmNsb3NlKCksdGhpcy50cmFuc3BvcnQucmVtb3ZlQWxsTGlzdGVuZXJzKCksdGhpcy5yZWFkeVN0YXRlPVwiY2xvc2VkXCIsdGhpcy5pZD1udWxsLHRoaXMuZW1pdChcImNsb3NlXCIsdCxlKSxuLndyaXRlQnVmZmVyPVtdLG4ucHJldkJ1ZmZlckxlbj0wfX0sci5wcm90b3R5cGUuZmlsdGVyVXBncmFkZXM9ZnVuY3Rpb24odCl7Zm9yKHZhciBlPVtdLG49MCxyPXQubGVuZ3RoO248cjtuKyspfmModGhpcy50cmFuc3BvcnRzLHRbbl0pJiZlLnB1c2godFtuXSk7cmV0dXJuIGV9fSkuY2FsbChlLGZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9KCkpfSxmdW5jdGlvbih0LGUsbil7KGZ1bmN0aW9uKHQpe2Z1bmN0aW9uIHIoZSl7dmFyIG4scj0hMSxhPSExLGM9ITEhPT1lLmpzb25wO2lmKHQubG9jYXRpb24pe3ZhciBwPVwiaHR0cHM6XCI9PT1sb2NhdGlvbi5wcm90b2NvbCx1PWxvY2F0aW9uLnBvcnQ7dXx8KHU9cD80NDM6ODApLHI9ZS5ob3N0bmFtZSE9PWxvY2F0aW9uLmhvc3RuYW1lfHx1IT09ZS5wb3J0LGE9ZS5zZWN1cmUhPT1wfWlmKGUueGRvbWFpbj1yLGUueHNjaGVtZT1hLG49bmV3IG8oZSksXCJvcGVuXCJpbiBuJiYhZS5mb3JjZUpTT05QKXJldHVybiBuZXcgaShlKTtpZighYyl0aHJvdyBuZXcgRXJyb3IoXCJKU09OUCBkaXNhYmxlZFwiKTtyZXR1cm4gbmV3IHMoZSl9dmFyIG89bigxOCksaT1uKDIwKSxzPW4oMzQpLGE9bigzNSk7ZS5wb2xsaW5nPXIsZS53ZWJzb2NrZXQ9YX0pLmNhbGwoZSxmdW5jdGlvbigpe3JldHVybiB0aGlzfSgpKX0sZnVuY3Rpb24odCxlLG4peyhmdW5jdGlvbihlKXt2YXIgcj1uKDE5KTt0LmV4cG9ydHM9ZnVuY3Rpb24odCl7dmFyIG49dC54ZG9tYWluLG89dC54c2NoZW1lLGk9dC5lbmFibGVzWERSO3RyeXtpZihcInVuZGVmaW5lZFwiIT10eXBlb2YgWE1MSHR0cFJlcXVlc3QmJighbnx8cikpcmV0dXJuIG5ldyBYTUxIdHRwUmVxdWVzdH1jYXRjaChzKXt9dHJ5e2lmKFwidW5kZWZpbmVkXCIhPXR5cGVvZiBYRG9tYWluUmVxdWVzdCYmIW8mJmkpcmV0dXJuIG5ldyBYRG9tYWluUmVxdWVzdH1jYXRjaChzKXt9aWYoIW4pdHJ5e1xuICAgIHJldHVybiBuZXcoZVtbXCJBY3RpdmVcIl0uY29uY2F0KFwiT2JqZWN0XCIpLmpvaW4oXCJYXCIpXSkoXCJNaWNyb3NvZnQuWE1MSFRUUFwiKX1jYXRjaChzKXt9fX0pLmNhbGwoZSxmdW5jdGlvbigpe3JldHVybiB0aGlzfSgpKX0sZnVuY3Rpb24odCxlKXt0cnl7dC5leHBvcnRzPVwidW5kZWZpbmVkXCIhPXR5cGVvZiBYTUxIdHRwUmVxdWVzdCYmXCJ3aXRoQ3JlZGVudGlhbHNcImluIG5ldyBYTUxIdHRwUmVxdWVzdH1jYXRjaChuKXt0LmV4cG9ydHM9ITF9fSxmdW5jdGlvbih0LGUsbil7KGZ1bmN0aW9uKGUpe2Z1bmN0aW9uIHIoKXt9ZnVuY3Rpb24gbyh0KXtpZihjLmNhbGwodGhpcyx0KSx0aGlzLnJlcXVlc3RUaW1lb3V0PXQucmVxdWVzdFRpbWVvdXQsdGhpcy5leHRyYUhlYWRlcnM9dC5leHRyYUhlYWRlcnMsZS5sb2NhdGlvbil7dmFyIG49XCJodHRwczpcIj09PWxvY2F0aW9uLnByb3RvY29sLHI9bG9jYXRpb24ucG9ydDtyfHwocj1uPzQ0Mzo4MCksdGhpcy54ZD10Lmhvc3RuYW1lIT09ZS5sb2NhdGlvbi5ob3N0bmFtZXx8ciE9PXQucG9ydCx0aGlzLnhzPXQuc2VjdXJlIT09bn19ZnVuY3Rpb24gaSh0KXt0aGlzLm1ldGhvZD10Lm1ldGhvZHx8XCJHRVRcIix0aGlzLnVyaT10LnVyaSx0aGlzLnhkPSEhdC54ZCx0aGlzLnhzPSEhdC54cyx0aGlzLmFzeW5jPSExIT09dC5hc3luYyx0aGlzLmRhdGE9dm9pZCAwIT09dC5kYXRhP3QuZGF0YTpudWxsLHRoaXMuYWdlbnQ9dC5hZ2VudCx0aGlzLmlzQmluYXJ5PXQuaXNCaW5hcnksdGhpcy5zdXBwb3J0c0JpbmFyeT10LnN1cHBvcnRzQmluYXJ5LHRoaXMuZW5hYmxlc1hEUj10LmVuYWJsZXNYRFIsdGhpcy5yZXF1ZXN0VGltZW91dD10LnJlcXVlc3RUaW1lb3V0LHRoaXMucGZ4PXQucGZ4LHRoaXMua2V5PXQua2V5LHRoaXMucGFzc3BocmFzZT10LnBhc3NwaHJhc2UsdGhpcy5jZXJ0PXQuY2VydCx0aGlzLmNhPXQuY2EsdGhpcy5jaXBoZXJzPXQuY2lwaGVycyx0aGlzLnJlamVjdFVuYXV0aG9yaXplZD10LnJlamVjdFVuYXV0aG9yaXplZCx0aGlzLmV4dHJhSGVhZGVycz10LmV4dHJhSGVhZGVycyx0aGlzLmNyZWF0ZSgpfWZ1bmN0aW9uIHMoKXtmb3IodmFyIHQgaW4gaS5yZXF1ZXN0cylpLnJlcXVlc3RzLmhhc093blByb3BlcnR5KHQpJiZpLnJlcXVlc3RzW3RdLmFib3J0KCl9dmFyIGE9bigxOCksYz1uKDIxKSxwPW4oOCksdT1uKDMyKSxoPW4oMykoXCJlbmdpbmUuaW8tY2xpZW50OnBvbGxpbmcteGhyXCIpO3QuZXhwb3J0cz1vLHQuZXhwb3J0cy5SZXF1ZXN0PWksdShvLGMpLG8ucHJvdG90eXBlLnN1cHBvcnRzQmluYXJ5PSEwLG8ucHJvdG90eXBlLnJlcXVlc3Q9ZnVuY3Rpb24odCl7cmV0dXJuIHQ9dHx8e30sdC51cmk9dGhpcy51cmkoKSx0LnhkPXRoaXMueGQsdC54cz10aGlzLnhzLHQuYWdlbnQ9dGhpcy5hZ2VudHx8ITEsdC5zdXBwb3J0c0JpbmFyeT10aGlzLnN1cHBvcnRzQmluYXJ5LHQuZW5hYmxlc1hEUj10aGlzLmVuYWJsZXNYRFIsdC5wZng9dGhpcy5wZngsdC5rZXk9dGhpcy5rZXksdC5wYXNzcGhyYXNlPXRoaXMucGFzc3BocmFzZSx0LmNlcnQ9dGhpcy5jZXJ0LHQuY2E9dGhpcy5jYSx0LmNpcGhlcnM9dGhpcy5jaXBoZXJzLHQucmVqZWN0VW5hdXRob3JpemVkPXRoaXMucmVqZWN0VW5hdXRob3JpemVkLHQucmVxdWVzdFRpbWVvdXQ9dGhpcy5yZXF1ZXN0VGltZW91dCx0LmV4dHJhSGVhZGVycz10aGlzLmV4dHJhSGVhZGVycyxuZXcgaSh0KX0sby5wcm90b3R5cGUuZG9Xcml0ZT1mdW5jdGlvbih0LGUpe3ZhciBuPVwic3RyaW5nXCIhPXR5cGVvZiB0JiZ2b2lkIDAhPT10LHI9dGhpcy5yZXF1ZXN0KHttZXRob2Q6XCJQT1NUXCIsZGF0YTp0LGlzQmluYXJ5Om59KSxvPXRoaXM7ci5vbihcInN1Y2Nlc3NcIixlKSxyLm9uKFwiZXJyb3JcIixmdW5jdGlvbih0KXtvLm9uRXJyb3IoXCJ4aHIgcG9zdCBlcnJvclwiLHQpfSksdGhpcy5zZW5kWGhyPXJ9LG8ucHJvdG90eXBlLmRvUG9sbD1mdW5jdGlvbigpe2goXCJ4aHIgcG9sbFwiKTt2YXIgdD10aGlzLnJlcXVlc3QoKSxlPXRoaXM7dC5vbihcImRhdGFcIixmdW5jdGlvbih0KXtlLm9uRGF0YSh0KX0pLHQub24oXCJlcnJvclwiLGZ1bmN0aW9uKHQpe2Uub25FcnJvcihcInhociBwb2xsIGVycm9yXCIsdCl9KSx0aGlzLnBvbGxYaHI9dH0scChpLnByb3RvdHlwZSksaS5wcm90b3R5cGUuY3JlYXRlPWZ1bmN0aW9uKCl7dmFyIHQ9e2FnZW50OnRoaXMuYWdlbnQseGRvbWFpbjp0aGlzLnhkLHhzY2hlbWU6dGhpcy54cyxlbmFibGVzWERSOnRoaXMuZW5hYmxlc1hEUn07dC5wZng9dGhpcy5wZngsdC5rZXk9dGhpcy5rZXksdC5wYXNzcGhyYXNlPXRoaXMucGFzc3BocmFzZSx0LmNlcnQ9dGhpcy5jZXJ0LHQuY2E9dGhpcy5jYSx0LmNpcGhlcnM9dGhpcy5jaXBoZXJzLHQucmVqZWN0VW5hdXRob3JpemVkPXRoaXMucmVqZWN0VW5hdXRob3JpemVkO3ZhciBuPXRoaXMueGhyPW5ldyBhKHQpLHI9dGhpczt0cnl7aChcInhociBvcGVuICVzOiAlc1wiLHRoaXMubWV0aG9kLHRoaXMudXJpKSxuLm9wZW4odGhpcy5tZXRob2QsdGhpcy51cmksdGhpcy5hc3luYyk7dHJ5e2lmKHRoaXMuZXh0cmFIZWFkZXJzKXtuLnNldERpc2FibGVIZWFkZXJDaGVjayYmbi5zZXREaXNhYmxlSGVhZGVyQ2hlY2soITApO2Zvcih2YXIgbyBpbiB0aGlzLmV4dHJhSGVhZGVycyl0aGlzLmV4dHJhSGVhZGVycy5oYXNPd25Qcm9wZXJ0eShvKSYmbi5zZXRSZXF1ZXN0SGVhZGVyKG8sdGhpcy5leHRyYUhlYWRlcnNbb10pfX1jYXRjaChzKXt9aWYoXCJQT1NUXCI9PT10aGlzLm1ldGhvZCl0cnl7dGhpcy5pc0JpbmFyeT9uLnNldFJlcXVlc3RIZWFkZXIoXCJDb250ZW50LXR5cGVcIixcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiKTpuLnNldFJlcXVlc3RIZWFkZXIoXCJDb250ZW50LXR5cGVcIixcInRleHQvcGxhaW47Y2hhcnNldD1VVEYtOFwiKX1jYXRjaChzKXt9dHJ5e24uc2V0UmVxdWVzdEhlYWRlcihcIkFjY2VwdFwiLFwiKi8qXCIpfWNhdGNoKHMpe31cIndpdGhDcmVkZW50aWFsc1wiaW4gbiYmKG4ud2l0aENyZWRlbnRpYWxzPSEwKSx0aGlzLnJlcXVlc3RUaW1lb3V0JiYobi50aW1lb3V0PXRoaXMucmVxdWVzdFRpbWVvdXQpLHRoaXMuaGFzWERSKCk/KG4ub25sb2FkPWZ1bmN0aW9uKCl7ci5vbkxvYWQoKX0sbi5vbmVycm9yPWZ1bmN0aW9uKCl7ci5vbkVycm9yKG4ucmVzcG9uc2VUZXh0KX0pOm4ub25yZWFkeXN0YXRlY2hhbmdlPWZ1bmN0aW9uKCl7aWYoMj09PW4ucmVhZHlTdGF0ZSl7dmFyIHQ7dHJ5e3Q9bi5nZXRSZXNwb25zZUhlYWRlcihcIkNvbnRlbnQtVHlwZVwiKX1jYXRjaChlKXt9XCJhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW1cIj09PXQmJihuLnJlc3BvbnNlVHlwZT1cImFycmF5YnVmZmVyXCIpfTQ9PT1uLnJlYWR5U3RhdGUmJigyMDA9PT1uLnN0YXR1c3x8MTIyMz09PW4uc3RhdHVzP3Iub25Mb2FkKCk6c2V0VGltZW91dChmdW5jdGlvbigpe3Iub25FcnJvcihuLnN0YXR1cyl9LDApKX0saChcInhociBkYXRhICVzXCIsdGhpcy5kYXRhKSxuLnNlbmQodGhpcy5kYXRhKX1jYXRjaChzKXtyZXR1cm4gdm9pZCBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7ci5vbkVycm9yKHMpfSwwKX1lLmRvY3VtZW50JiYodGhpcy5pbmRleD1pLnJlcXVlc3RzQ291bnQrKyxpLnJlcXVlc3RzW3RoaXMuaW5kZXhdPXRoaXMpfSxpLnByb3RvdHlwZS5vblN1Y2Nlc3M9ZnVuY3Rpb24oKXt0aGlzLmVtaXQoXCJzdWNjZXNzXCIpLHRoaXMuY2xlYW51cCgpfSxpLnByb3RvdHlwZS5vbkRhdGE9ZnVuY3Rpb24odCl7dGhpcy5lbWl0KFwiZGF0YVwiLHQpLHRoaXMub25TdWNjZXNzKCl9LGkucHJvdG90eXBlLm9uRXJyb3I9ZnVuY3Rpb24odCl7dGhpcy5lbWl0KFwiZXJyb3JcIix0KSx0aGlzLmNsZWFudXAoITApfSxpLnByb3RvdHlwZS5jbGVhbnVwPWZ1bmN0aW9uKHQpe2lmKFwidW5kZWZpbmVkXCIhPXR5cGVvZiB0aGlzLnhociYmbnVsbCE9PXRoaXMueGhyKXtpZih0aGlzLmhhc1hEUigpP3RoaXMueGhyLm9ubG9hZD10aGlzLnhoci5vbmVycm9yPXI6dGhpcy54aHIub25yZWFkeXN0YXRlY2hhbmdlPXIsdCl0cnl7dGhpcy54aHIuYWJvcnQoKX1jYXRjaChuKXt9ZS5kb2N1bWVudCYmZGVsZXRlIGkucmVxdWVzdHNbdGhpcy5pbmRleF0sdGhpcy54aHI9bnVsbH19LGkucHJvdG90eXBlLm9uTG9hZD1mdW5jdGlvbigpe3ZhciB0O3RyeXt2YXIgZTt0cnl7ZT10aGlzLnhoci5nZXRSZXNwb25zZUhlYWRlcihcIkNvbnRlbnQtVHlwZVwiKX1jYXRjaChuKXt9dD1cImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiPT09ZT90aGlzLnhoci5yZXNwb25zZXx8dGhpcy54aHIucmVzcG9uc2VUZXh0OnRoaXMueGhyLnJlc3BvbnNlVGV4dH1jYXRjaChuKXt0aGlzLm9uRXJyb3Iobil9bnVsbCE9dCYmdGhpcy5vbkRhdGEodCl9LGkucHJvdG90eXBlLmhhc1hEUj1mdW5jdGlvbigpe3JldHVyblwidW5kZWZpbmVkXCIhPXR5cGVvZiBlLlhEb21haW5SZXF1ZXN0JiYhdGhpcy54cyYmdGhpcy5lbmFibGVzWERSfSxpLnByb3RvdHlwZS5hYm9ydD1mdW5jdGlvbigpe3RoaXMuY2xlYW51cCgpfSxpLnJlcXVlc3RzQ291bnQ9MCxpLnJlcXVlc3RzPXt9LGUuZG9jdW1lbnQmJihlLmF0dGFjaEV2ZW50P2UuYXR0YWNoRXZlbnQoXCJvbnVubG9hZFwiLHMpOmUuYWRkRXZlbnRMaXN0ZW5lciYmZS5hZGRFdmVudExpc3RlbmVyKFwiYmVmb3JldW5sb2FkXCIscywhMSkpfSkuY2FsbChlLGZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9KCkpfSxmdW5jdGlvbih0LGUsbil7ZnVuY3Rpb24gcih0KXt2YXIgZT10JiZ0LmZvcmNlQmFzZTY0O3UmJiFlfHwodGhpcy5zdXBwb3J0c0JpbmFyeT0hMSksby5jYWxsKHRoaXMsdCl9dmFyIG89bigyMiksaT1uKDMxKSxzPW4oMjMpLGE9bigzMiksYz1uKDMzKSxwPW4oMykoXCJlbmdpbmUuaW8tY2xpZW50OnBvbGxpbmdcIik7dC5leHBvcnRzPXI7dmFyIHU9ZnVuY3Rpb24oKXt2YXIgdD1uKDE4KSxlPW5ldyB0KHt4ZG9tYWluOiExfSk7cmV0dXJuIG51bGwhPWUucmVzcG9uc2VUeXBlfSgpO2EocixvKSxyLnByb3RvdHlwZS5uYW1lPVwicG9sbGluZ1wiLHIucHJvdG90eXBlLmRvT3Blbj1mdW5jdGlvbigpe3RoaXMucG9sbCgpfSxyLnByb3RvdHlwZS5wYXVzZT1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKCl7cChcInBhdXNlZFwiKSxuLnJlYWR5U3RhdGU9XCJwYXVzZWRcIix0KCl9dmFyIG49dGhpcztpZih0aGlzLnJlYWR5U3RhdGU9XCJwYXVzaW5nXCIsdGhpcy5wb2xsaW5nfHwhdGhpcy53cml0YWJsZSl7dmFyIHI9MDt0aGlzLnBvbGxpbmcmJihwKFwid2UgYXJlIGN1cnJlbnRseSBwb2xsaW5nIC0gd2FpdGluZyB0byBwYXVzZVwiKSxyKyssdGhpcy5vbmNlKFwicG9sbENvbXBsZXRlXCIsZnVuY3Rpb24oKXtwKFwicHJlLXBhdXNlIHBvbGxpbmcgY29tcGxldGVcIiksLS1yfHxlKCl9KSksdGhpcy53cml0YWJsZXx8KHAoXCJ3ZSBhcmUgY3VycmVudGx5IHdyaXRpbmcgLSB3YWl0aW5nIHRvIHBhdXNlXCIpLHIrKyx0aGlzLm9uY2UoXCJkcmFpblwiLGZ1bmN0aW9uKCl7cChcInByZS1wYXVzZSB3cml0aW5nIGNvbXBsZXRlXCIpLC0tcnx8ZSgpfSkpfWVsc2UgZSgpfSxyLnByb3RvdHlwZS5wb2xsPWZ1bmN0aW9uKCl7cChcInBvbGxpbmdcIiksdGhpcy5wb2xsaW5nPSEwLHRoaXMuZG9Qb2xsKCksdGhpcy5lbWl0KFwicG9sbFwiKX0sci5wcm90b3R5cGUub25EYXRhPWZ1bmN0aW9uKHQpe3ZhciBlPXRoaXM7cChcInBvbGxpbmcgZ290IGRhdGEgJXNcIix0KTt2YXIgbj1mdW5jdGlvbih0LG4scil7cmV0dXJuXCJvcGVuaW5nXCI9PT1lLnJlYWR5U3RhdGUmJmUub25PcGVuKCksXCJjbG9zZVwiPT09dC50eXBlPyhlLm9uQ2xvc2UoKSwhMSk6dm9pZCBlLm9uUGFja2V0KHQpfTtzLmRlY29kZVBheWxvYWQodCx0aGlzLnNvY2tldC5iaW5hcnlUeXBlLG4pLFwiY2xvc2VkXCIhPT10aGlzLnJlYWR5U3RhdGUmJih0aGlzLnBvbGxpbmc9ITEsdGhpcy5lbWl0KFwicG9sbENvbXBsZXRlXCIpLFwib3BlblwiPT09dGhpcy5yZWFkeVN0YXRlP3RoaXMucG9sbCgpOnAoJ2lnbm9yaW5nIHBvbGwgLSB0cmFuc3BvcnQgc3RhdGUgXCIlc1wiJyx0aGlzLnJlYWR5U3RhdGUpKX0sci5wcm90b3R5cGUuZG9DbG9zZT1mdW5jdGlvbigpe2Z1bmN0aW9uIHQoKXtwKFwid3JpdGluZyBjbG9zZSBwYWNrZXRcIiksZS53cml0ZShbe3R5cGU6XCJjbG9zZVwifV0pfXZhciBlPXRoaXM7XCJvcGVuXCI9PT10aGlzLnJlYWR5U3RhdGU/KHAoXCJ0cmFuc3BvcnQgb3BlbiAtIGNsb3NpbmdcIiksdCgpKToocChcInRyYW5zcG9ydCBub3Qgb3BlbiAtIGRlZmVycmluZyBjbG9zZVwiKSx0aGlzLm9uY2UoXCJvcGVuXCIsdCkpfSxyLnByb3RvdHlwZS53cml0ZT1mdW5jdGlvbih0KXt2YXIgZT10aGlzO3RoaXMud3JpdGFibGU9ITE7dmFyIG49ZnVuY3Rpb24oKXtlLndyaXRhYmxlPSEwLGUuZW1pdChcImRyYWluXCIpfTtzLmVuY29kZVBheWxvYWQodCx0aGlzLnN1cHBvcnRzQmluYXJ5LGZ1bmN0aW9uKHQpe2UuZG9Xcml0ZSh0LG4pfSl9LHIucHJvdG90eXBlLnVyaT1mdW5jdGlvbigpe3ZhciB0PXRoaXMucXVlcnl8fHt9LGU9dGhpcy5zZWN1cmU/XCJodHRwc1wiOlwiaHR0cFwiLG49XCJcIjshMSE9PXRoaXMudGltZXN0YW1wUmVxdWVzdHMmJih0W3RoaXMudGltZXN0YW1wUGFyYW1dPWMoKSksdGhpcy5zdXBwb3J0c0JpbmFyeXx8dC5zaWR8fCh0LmI2ND0xKSx0PWkuZW5jb2RlKHQpLHRoaXMucG9ydCYmKFwiaHR0cHNcIj09PWUmJjQ0MyE9PU51bWJlcih0aGlzLnBvcnQpfHxcImh0dHBcIj09PWUmJjgwIT09TnVtYmVyKHRoaXMucG9ydCkpJiYobj1cIjpcIit0aGlzLnBvcnQpLHQubGVuZ3RoJiYodD1cIj9cIit0KTt2YXIgcj10aGlzLmhvc3RuYW1lLmluZGV4T2YoXCI6XCIpIT09LTE7cmV0dXJuIGUrXCI6Ly9cIisocj9cIltcIit0aGlzLmhvc3RuYW1lK1wiXVwiOnRoaXMuaG9zdG5hbWUpK24rdGhpcy5wYXRoK3R9fSxmdW5jdGlvbih0LGUsbil7ZnVuY3Rpb24gcih0KXt0aGlzLnBhdGg9dC5wYXRoLHRoaXMuaG9zdG5hbWU9dC5ob3N0bmFtZSx0aGlzLnBvcnQ9dC5wb3J0LHRoaXMuc2VjdXJlPXQuc2VjdXJlLHRoaXMucXVlcnk9dC5xdWVyeSx0aGlzLnRpbWVzdGFtcFBhcmFtPXQudGltZXN0YW1wUGFyYW0sdGhpcy50aW1lc3RhbXBSZXF1ZXN0cz10LnRpbWVzdGFtcFJlcXVlc3RzLHRoaXMucmVhZHlTdGF0ZT1cIlwiLHRoaXMuYWdlbnQ9dC5hZ2VudHx8ITEsdGhpcy5zb2NrZXQ9dC5zb2NrZXQsdGhpcy5lbmFibGVzWERSPXQuZW5hYmxlc1hEUix0aGlzLnBmeD10LnBmeCx0aGlzLmtleT10LmtleSx0aGlzLnBhc3NwaHJhc2U9dC5wYXNzcGhyYXNlLHRoaXMuY2VydD10LmNlcnQsdGhpcy5jYT10LmNhLHRoaXMuY2lwaGVycz10LmNpcGhlcnMsdGhpcy5yZWplY3RVbmF1dGhvcml6ZWQ9dC5yZWplY3RVbmF1dGhvcml6ZWQsdGhpcy5mb3JjZU5vZGU9dC5mb3JjZU5vZGUsdGhpcy5leHRyYUhlYWRlcnM9dC5leHRyYUhlYWRlcnMsdGhpcy5sb2NhbEFkZHJlc3M9dC5sb2NhbEFkZHJlc3N9dmFyIG89bigyMyksaT1uKDgpO3QuZXhwb3J0cz1yLGkoci5wcm90b3R5cGUpLHIucHJvdG90eXBlLm9uRXJyb3I9ZnVuY3Rpb24odCxlKXt2YXIgbj1uZXcgRXJyb3IodCk7cmV0dXJuIG4udHlwZT1cIlRyYW5zcG9ydEVycm9yXCIsbi5kZXNjcmlwdGlvbj1lLHRoaXMuZW1pdChcImVycm9yXCIsbiksdGhpc30sci5wcm90b3R5cGUub3Blbj1mdW5jdGlvbigpe3JldHVyblwiY2xvc2VkXCIhPT10aGlzLnJlYWR5U3RhdGUmJlwiXCIhPT10aGlzLnJlYWR5U3RhdGV8fCh0aGlzLnJlYWR5U3RhdGU9XCJvcGVuaW5nXCIsdGhpcy5kb09wZW4oKSksdGhpc30sci5wcm90b3R5cGUuY2xvc2U9ZnVuY3Rpb24oKXtyZXR1cm5cIm9wZW5pbmdcIiE9PXRoaXMucmVhZHlTdGF0ZSYmXCJvcGVuXCIhPT10aGlzLnJlYWR5U3RhdGV8fCh0aGlzLmRvQ2xvc2UoKSx0aGlzLm9uQ2xvc2UoKSksdGhpc30sci5wcm90b3R5cGUuc2VuZD1mdW5jdGlvbih0KXtpZihcIm9wZW5cIiE9PXRoaXMucmVhZHlTdGF0ZSl0aHJvdyBuZXcgRXJyb3IoXCJUcmFuc3BvcnQgbm90IG9wZW5cIik7dGhpcy53cml0ZSh0KX0sci5wcm90b3R5cGUub25PcGVuPWZ1bmN0aW9uKCl7dGhpcy5yZWFkeVN0YXRlPVwib3BlblwiLHRoaXMud3JpdGFibGU9ITAsdGhpcy5lbWl0KFwib3BlblwiKX0sci5wcm90b3R5cGUub25EYXRhPWZ1bmN0aW9uKHQpe3ZhciBlPW8uZGVjb2RlUGFja2V0KHQsdGhpcy5zb2NrZXQuYmluYXJ5VHlwZSk7dGhpcy5vblBhY2tldChlKX0sci5wcm90b3R5cGUub25QYWNrZXQ9ZnVuY3Rpb24odCl7dGhpcy5lbWl0KFwicGFja2V0XCIsdCl9LHIucHJvdG90eXBlLm9uQ2xvc2U9ZnVuY3Rpb24oKXt0aGlzLnJlYWR5U3RhdGU9XCJjbG9zZWRcIix0aGlzLmVtaXQoXCJjbG9zZVwiKX19LGZ1bmN0aW9uKHQsZSxuKXsoZnVuY3Rpb24odCl7ZnVuY3Rpb24gcih0LG4pe3ZhciByPVwiYlwiK2UucGFja2V0c1t0LnR5cGVdK3QuZGF0YS5kYXRhO3JldHVybiBuKHIpfWZ1bmN0aW9uIG8odCxuLHIpe2lmKCFuKXJldHVybiBlLmVuY29kZUJhc2U2NFBhY2tldCh0LHIpO3ZhciBvPXQuZGF0YSxpPW5ldyBVaW50OEFycmF5KG8pLHM9bmV3IFVpbnQ4QXJyYXkoMStvLmJ5dGVMZW5ndGgpO3NbMF09dlt0LnR5cGVdO2Zvcih2YXIgYT0wO2E8aS5sZW5ndGg7YSsrKXNbYSsxXT1pW2FdO3JldHVybiByKHMuYnVmZmVyKX1mdW5jdGlvbiBpKHQsbixyKXtpZighbilyZXR1cm4gZS5lbmNvZGVCYXNlNjRQYWNrZXQodCxyKTt2YXIgbz1uZXcgRmlsZVJlYWRlcjtyZXR1cm4gby5vbmxvYWQ9ZnVuY3Rpb24oKXt0LmRhdGE9by5yZXN1bHQsZS5lbmNvZGVQYWNrZXQodCxuLCEwLHIpfSxvLnJlYWRBc0FycmF5QnVmZmVyKHQuZGF0YSl9ZnVuY3Rpb24gcyh0LG4scil7aWYoIW4pcmV0dXJuIGUuZW5jb2RlQmFzZTY0UGFja2V0KHQscik7aWYoZylyZXR1cm4gaSh0LG4scik7dmFyIG89bmV3IFVpbnQ4QXJyYXkoMSk7b1swXT12W3QudHlwZV07dmFyIHM9bmV3IGsoW28uYnVmZmVyLHQuZGF0YV0pO3JldHVybiByKHMpfWZ1bmN0aW9uIGEodCl7dHJ5e3Q9ZC5kZWNvZGUodCx7c3RyaWN0OiExfSl9Y2F0Y2goZSl7cmV0dXJuITF9cmV0dXJuIHR9ZnVuY3Rpb24gYyh0LGUsbil7Zm9yKHZhciByPW5ldyBBcnJheSh0Lmxlbmd0aCksbz1sKHQubGVuZ3RoLG4pLGk9ZnVuY3Rpb24odCxuLG8pe2UobixmdW5jdGlvbihlLG4pe3JbdF09bixvKGUscil9KX0scz0wO3M8dC5sZW5ndGg7cysrKWkocyx0W3NdLG8pfXZhciBwLHU9bigyNCksaD1uKDkpLGY9bigyNSksbD1uKDI2KSxkPW4oMjcpO3QmJnQuQXJyYXlCdWZmZXImJihwPW4oMjkpKTt2YXIgeT1cInVuZGVmaW5lZFwiIT10eXBlb2YgbmF2aWdhdG9yJiYvQW5kcm9pZC9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCksbT1cInVuZGVmaW5lZFwiIT10eXBlb2YgbmF2aWdhdG9yJiYvUGhhbnRvbUpTL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSxnPXl8fG07ZS5wcm90b2NvbD0zO3ZhciB2PWUucGFja2V0cz17b3BlbjowLGNsb3NlOjEscGluZzoyLHBvbmc6MyxtZXNzYWdlOjQsdXBncmFkZTo1LG5vb3A6Nn0sYj11KHYpLHc9e3R5cGU6XCJlcnJvclwiLGRhdGE6XCJwYXJzZXIgZXJyb3JcIn0saz1uKDMwKTtlLmVuY29kZVBhY2tldD1mdW5jdGlvbihlLG4saSxhKXtcImZ1bmN0aW9uXCI9PXR5cGVvZiBuJiYoYT1uLG49ITEpLFwiZnVuY3Rpb25cIj09dHlwZW9mIGkmJihhPWksaT1udWxsKTt2YXIgYz12b2lkIDA9PT1lLmRhdGE/dm9pZCAwOmUuZGF0YS5idWZmZXJ8fGUuZGF0YTtpZih0LkFycmF5QnVmZmVyJiZjIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpcmV0dXJuIG8oZSxuLGEpO2lmKGsmJmMgaW5zdGFuY2VvZiB0LkJsb2IpcmV0dXJuIHMoZSxuLGEpO2lmKGMmJmMuYmFzZTY0KXJldHVybiByKGUsYSk7dmFyIHA9dltlLnR5cGVdO3JldHVybiB2b2lkIDAhPT1lLmRhdGEmJihwKz1pP2QuZW5jb2RlKFN0cmluZyhlLmRhdGEpLHtzdHJpY3Q6ITF9KTpTdHJpbmcoZS5kYXRhKSksYShcIlwiK3ApfSxlLmVuY29kZUJhc2U2NFBhY2tldD1mdW5jdGlvbihuLHIpe3ZhciBvPVwiYlwiK2UucGFja2V0c1tuLnR5cGVdO2lmKGsmJm4uZGF0YSBpbnN0YW5jZW9mIHQuQmxvYil7dmFyIGk9bmV3IEZpbGVSZWFkZXI7cmV0dXJuIGkub25sb2FkPWZ1bmN0aW9uKCl7dmFyIHQ9aS5yZXN1bHQuc3BsaXQoXCIsXCIpWzFdO3Iobyt0KX0saS5yZWFkQXNEYXRhVVJMKG4uZGF0YSl9dmFyIHM7dHJ5e3M9U3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLG5ldyBVaW50OEFycmF5KG4uZGF0YSkpfWNhdGNoKGEpe2Zvcih2YXIgYz1uZXcgVWludDhBcnJheShuLmRhdGEpLHA9bmV3IEFycmF5KGMubGVuZ3RoKSx1PTA7dTxjLmxlbmd0aDt1KyspcFt1XT1jW3VdO3M9U3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLHApfXJldHVybiBvKz10LmJ0b2EocykscihvKX0sZS5kZWNvZGVQYWNrZXQ9ZnVuY3Rpb24odCxuLHIpe2lmKHZvaWQgMD09PXQpcmV0dXJuIHc7aWYoXCJzdHJpbmdcIj09dHlwZW9mIHQpe2lmKFwiYlwiPT09dC5jaGFyQXQoMCkpcmV0dXJuIGUuZGVjb2RlQmFzZTY0UGFja2V0KHQuc3Vic3RyKDEpLG4pO2lmKHImJih0PWEodCksdD09PSExKSlyZXR1cm4gdzt2YXIgbz10LmNoYXJBdCgwKTtyZXR1cm4gTnVtYmVyKG8pPT1vJiZiW29dP3QubGVuZ3RoPjE/e3R5cGU6YltvXSxkYXRhOnQuc3Vic3RyaW5nKDEpfTp7dHlwZTpiW29dfTp3fXZhciBpPW5ldyBVaW50OEFycmF5KHQpLG89aVswXSxzPWYodCwxKTtyZXR1cm4gayYmXCJibG9iXCI9PT1uJiYocz1uZXcgayhbc10pKSx7dHlwZTpiW29dLGRhdGE6c319LGUuZGVjb2RlQmFzZTY0UGFja2V0PWZ1bmN0aW9uKHQsZSl7dmFyIG49Ylt0LmNoYXJBdCgwKV07aWYoIXApcmV0dXJue3R5cGU6bixkYXRhOntiYXNlNjQ6ITAsZGF0YTp0LnN1YnN0cigxKX19O3ZhciByPXAuZGVjb2RlKHQuc3Vic3RyKDEpKTtyZXR1cm5cImJsb2JcIj09PWUmJmsmJihyPW5ldyBrKFtyXSkpLHt0eXBlOm4sZGF0YTpyfX0sZS5lbmNvZGVQYXlsb2FkPWZ1bmN0aW9uKHQsbixyKXtmdW5jdGlvbiBvKHQpe3JldHVybiB0Lmxlbmd0aCtcIjpcIit0fWZ1bmN0aW9uIGkodCxyKXtlLmVuY29kZVBhY2tldCh0LCEhcyYmbiwhMSxmdW5jdGlvbih0KXtyKG51bGwsbyh0KSl9KX1cImZ1bmN0aW9uXCI9PXR5cGVvZiBuJiYocj1uLG49bnVsbCk7dmFyIHM9aCh0KTtyZXR1cm4gbiYmcz9rJiYhZz9lLmVuY29kZVBheWxvYWRBc0Jsb2IodCxyKTplLmVuY29kZVBheWxvYWRBc0FycmF5QnVmZmVyKHQscik6dC5sZW5ndGg/dm9pZCBjKHQsaSxmdW5jdGlvbih0LGUpe3JldHVybiByKGUuam9pbihcIlwiKSl9KTpyKFwiMDpcIil9LGUuZGVjb2RlUGF5bG9hZD1mdW5jdGlvbih0LG4scil7aWYoXCJzdHJpbmdcIiE9dHlwZW9mIHQpcmV0dXJuIGUuZGVjb2RlUGF5bG9hZEFzQmluYXJ5KHQsbixyKTtcImZ1bmN0aW9uXCI9PXR5cGVvZiBuJiYocj1uLG49bnVsbCk7dmFyIG87aWYoXCJcIj09PXQpcmV0dXJuIHIodywwLDEpO2Zvcih2YXIgaSxzLGE9XCJcIixjPTAscD10Lmxlbmd0aDtjPHA7YysrKXt2YXIgdT10LmNoYXJBdChjKTtpZihcIjpcIj09PXUpe2lmKFwiXCI9PT1hfHxhIT0oaT1OdW1iZXIoYSkpKXJldHVybiByKHcsMCwxKTtpZihzPXQuc3Vic3RyKGMrMSxpKSxhIT1zLmxlbmd0aClyZXR1cm4gcih3LDAsMSk7aWYocy5sZW5ndGgpe2lmKG89ZS5kZWNvZGVQYWNrZXQocyxuLCExKSx3LnR5cGU9PT1vLnR5cGUmJncuZGF0YT09PW8uZGF0YSlyZXR1cm4gcih3LDAsMSk7dmFyIGg9cihvLGMraSxwKTtpZighMT09PWgpcmV0dXJufWMrPWksYT1cIlwifWVsc2UgYSs9dX1yZXR1cm5cIlwiIT09YT9yKHcsMCwxKTp2b2lkIDB9LGUuZW5jb2RlUGF5bG9hZEFzQXJyYXlCdWZmZXI9ZnVuY3Rpb24odCxuKXtmdW5jdGlvbiByKHQsbil7ZS5lbmNvZGVQYWNrZXQodCwhMCwhMCxmdW5jdGlvbih0KXtyZXR1cm4gbihudWxsLHQpfSl9cmV0dXJuIHQubGVuZ3RoP3ZvaWQgYyh0LHIsZnVuY3Rpb24odCxlKXt2YXIgcj1lLnJlZHVjZShmdW5jdGlvbih0LGUpe3ZhciBuO3JldHVybiBuPVwic3RyaW5nXCI9PXR5cGVvZiBlP2UubGVuZ3RoOmUuYnl0ZUxlbmd0aCx0K24udG9TdHJpbmcoKS5sZW5ndGgrbisyfSwwKSxvPW5ldyBVaW50OEFycmF5KHIpLGk9MDtyZXR1cm4gZS5mb3JFYWNoKGZ1bmN0aW9uKHQpe3ZhciBlPVwic3RyaW5nXCI9PXR5cGVvZiB0LG49dDtpZihlKXtmb3IodmFyIHI9bmV3IFVpbnQ4QXJyYXkodC5sZW5ndGgpLHM9MDtzPHQubGVuZ3RoO3MrKylyW3NdPXQuY2hhckNvZGVBdChzKTtuPXIuYnVmZmVyfWU/b1tpKytdPTA6b1tpKytdPTE7Zm9yKHZhciBhPW4uYnl0ZUxlbmd0aC50b1N0cmluZygpLHM9MDtzPGEubGVuZ3RoO3MrKylvW2krK109cGFyc2VJbnQoYVtzXSk7b1tpKytdPTI1NTtmb3IodmFyIHI9bmV3IFVpbnQ4QXJyYXkobikscz0wO3M8ci5sZW5ndGg7cysrKW9baSsrXT1yW3NdfSksbihvLmJ1ZmZlcil9KTpuKG5ldyBBcnJheUJ1ZmZlcigwKSl9LGUuZW5jb2RlUGF5bG9hZEFzQmxvYj1mdW5jdGlvbih0LG4pe2Z1bmN0aW9uIHIodCxuKXtlLmVuY29kZVBhY2tldCh0LCEwLCEwLGZ1bmN0aW9uKHQpe3ZhciBlPW5ldyBVaW50OEFycmF5KDEpO2lmKGVbMF09MSxcInN0cmluZ1wiPT10eXBlb2YgdCl7Zm9yKHZhciByPW5ldyBVaW50OEFycmF5KHQubGVuZ3RoKSxvPTA7bzx0Lmxlbmd0aDtvKyspcltvXT10LmNoYXJDb2RlQXQobyk7dD1yLmJ1ZmZlcixlWzBdPTB9Zm9yKHZhciBpPXQgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcj90LmJ5dGVMZW5ndGg6dC5zaXplLHM9aS50b1N0cmluZygpLGE9bmV3IFVpbnQ4QXJyYXkocy5sZW5ndGgrMSksbz0wO288cy5sZW5ndGg7bysrKWFbb109cGFyc2VJbnQoc1tvXSk7aWYoYVtzLmxlbmd0aF09MjU1LGspe3ZhciBjPW5ldyBrKFtlLmJ1ZmZlcixhLmJ1ZmZlcix0XSk7bihudWxsLGMpfX0pfWModCxyLGZ1bmN0aW9uKHQsZSl7cmV0dXJuIG4obmV3IGsoZSkpfSl9LGUuZGVjb2RlUGF5bG9hZEFzQmluYXJ5PWZ1bmN0aW9uKHQsbixyKXtcImZ1bmN0aW9uXCI9PXR5cGVvZiBuJiYocj1uLG49bnVsbCk7Zm9yKHZhciBvPXQsaT1bXTtvLmJ5dGVMZW5ndGg+MDspe2Zvcih2YXIgcz1uZXcgVWludDhBcnJheShvKSxhPTA9PT1zWzBdLGM9XCJcIixwPTE7MjU1IT09c1twXTtwKyspe2lmKGMubGVuZ3RoPjMxMClyZXR1cm4gcih3LDAsMSk7Yys9c1twXX1vPWYobywyK2MubGVuZ3RoKSxjPXBhcnNlSW50KGMpO3ZhciB1PWYobywwLGMpO2lmKGEpdHJ5e3U9U3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLG5ldyBVaW50OEFycmF5KHUpKX1jYXRjaChoKXt2YXIgbD1uZXcgVWludDhBcnJheSh1KTt1PVwiXCI7Zm9yKHZhciBwPTA7cDxsLmxlbmd0aDtwKyspdSs9U3RyaW5nLmZyb21DaGFyQ29kZShsW3BdKX1pLnB1c2godSksbz1mKG8sYyl9dmFyIGQ9aS5sZW5ndGg7aS5mb3JFYWNoKGZ1bmN0aW9uKHQsbyl7cihlLmRlY29kZVBhY2tldCh0LG4sITApLG8sZCl9KX19KS5jYWxsKGUsZnVuY3Rpb24oKXtyZXR1cm4gdGhpc30oKSl9LGZ1bmN0aW9uKHQsZSl7dC5leHBvcnRzPU9iamVjdC5rZXlzfHxmdW5jdGlvbih0KXt2YXIgZT1bXSxuPU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7Zm9yKHZhciByIGluIHQpbi5jYWxsKHQscikmJmUucHVzaChyKTtyZXR1cm4gZX19LGZ1bmN0aW9uKHQsZSl7dC5leHBvcnRzPWZ1bmN0aW9uKHQsZSxuKXt2YXIgcj10LmJ5dGVMZW5ndGg7aWYoZT1lfHwwLG49bnx8cix0LnNsaWNlKXJldHVybiB0LnNsaWNlKGUsbik7aWYoZTwwJiYoZSs9ciksbjwwJiYobis9ciksbj5yJiYobj1yKSxlPj1yfHxlPj1ufHwwPT09cilyZXR1cm4gbmV3IEFycmF5QnVmZmVyKDApO2Zvcih2YXIgbz1uZXcgVWludDhBcnJheSh0KSxpPW5ldyBVaW50OEFycmF5KG4tZSkscz1lLGE9MDtzPG47cysrLGErKylpW2FdPW9bc107cmV0dXJuIGkuYnVmZmVyfX0sZnVuY3Rpb24odCxlKXtmdW5jdGlvbiBuKHQsZSxuKXtmdW5jdGlvbiBvKHQscil7aWYoby5jb3VudDw9MCl0aHJvdyBuZXcgRXJyb3IoXCJhZnRlciBjYWxsZWQgdG9vIG1hbnkgdGltZXNcIik7LS1vLmNvdW50LHQ/KGk9ITAsZSh0KSxlPW4pOjAhPT1vLmNvdW50fHxpfHxlKG51bGwscil9dmFyIGk9ITE7cmV0dXJuIG49bnx8cixvLmNvdW50PXQsMD09PXQ/ZSgpOm99ZnVuY3Rpb24gcigpe310LmV4cG9ydHM9bn0sZnVuY3Rpb24odCxlLG4pe3ZhciByOyhmdW5jdGlvbih0LG8peyFmdW5jdGlvbihpKXtmdW5jdGlvbiBzKHQpe2Zvcih2YXIgZSxuLHI9W10sbz0wLGk9dC5sZW5ndGg7bzxpOyllPXQuY2hhckNvZGVBdChvKyspLGU+PTU1Mjk2JiZlPD01NjMxOSYmbzxpPyhuPXQuY2hhckNvZGVBdChvKyspLDU2MzIwPT0oNjQ1MTImbik/ci5wdXNoKCgoMTAyMyZlKTw8MTApKygxMDIzJm4pKzY1NTM2KTooci5wdXNoKGUpLG8tLSkpOnIucHVzaChlKTtyZXR1cm4gcn1mdW5jdGlvbiBhKHQpe2Zvcih2YXIgZSxuPXQubGVuZ3RoLHI9LTEsbz1cIlwiOysrcjxuOyllPXRbcl0sZT42NTUzNSYmKGUtPTY1NTM2LG8rPXcoZT4+PjEwJjEwMjN8NTUyOTYpLGU9NTYzMjB8MTAyMyZlKSxvKz13KGUpO3JldHVybiBvfWZ1bmN0aW9uIGModCxlKXtpZih0Pj01NTI5NiYmdDw9NTczNDMpe2lmKGUpdGhyb3cgRXJyb3IoXCJMb25lIHN1cnJvZ2F0ZSBVK1wiK3QudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkrXCIgaXMgbm90IGEgc2NhbGFyIHZhbHVlXCIpO3JldHVybiExfXJldHVybiEwfWZ1bmN0aW9uIHAodCxlKXtyZXR1cm4gdyh0Pj5lJjYzfDEyOCl9ZnVuY3Rpb24gdSh0LGUpe2lmKDA9PSg0Mjk0OTY3MTY4JnQpKXJldHVybiB3KHQpO3ZhciBuPVwiXCI7cmV0dXJuIDA9PSg0Mjk0OTY1MjQ4JnQpP249dyh0Pj42JjMxfDE5Mik6MD09KDQyOTQ5MDE3NjAmdCk/KGModCxlKXx8KHQ9NjU1MzMpLG49dyh0Pj4xMiYxNXwyMjQpLG4rPXAodCw2KSk6MD09KDQyOTI4NzAxNDQmdCkmJihuPXcodD4+MTgmN3wyNDApLG4rPXAodCwxMiksbis9cCh0LDYpKSxuKz13KDYzJnR8MTI4KX1mdW5jdGlvbiBoKHQsZSl7ZT1lfHx7fTtmb3IodmFyIG4scj0hMSE9PWUuc3RyaWN0LG89cyh0KSxpPW8ubGVuZ3RoLGE9LTEsYz1cIlwiOysrYTxpOyluPW9bYV0sYys9dShuLHIpO3JldHVybiBjfWZ1bmN0aW9uIGYoKXtpZihiPj12KXRocm93IEVycm9yKFwiSW52YWxpZCBieXRlIGluZGV4XCIpO3ZhciB0PTI1NSZnW2JdO2lmKGIrKywxMjg9PSgxOTImdCkpcmV0dXJuIDYzJnQ7dGhyb3cgRXJyb3IoXCJJbnZhbGlkIGNvbnRpbnVhdGlvbiBieXRlXCIpfWZ1bmN0aW9uIGwodCl7dmFyIGUsbixyLG8saTtpZihiPnYpdGhyb3cgRXJyb3IoXCJJbnZhbGlkIGJ5dGUgaW5kZXhcIik7aWYoYj09dilyZXR1cm4hMTtpZihlPTI1NSZnW2JdLGIrKywwPT0oMTI4JmUpKXJldHVybiBlO2lmKDE5Mj09KDIyNCZlKSl7aWYobj1mKCksaT0oMzEmZSk8PDZ8bixpPj0xMjgpcmV0dXJuIGk7dGhyb3cgRXJyb3IoXCJJbnZhbGlkIGNvbnRpbnVhdGlvbiBieXRlXCIpfWlmKDIyND09KDI0MCZlKSl7aWYobj1mKCkscj1mKCksaT0oMTUmZSk8PDEyfG48PDZ8cixpPj0yMDQ4KXJldHVybiBjKGksdCk/aTo2NTUzMzt0aHJvdyBFcnJvcihcIkludmFsaWQgY29udGludWF0aW9uIGJ5dGVcIil9aWYoMjQwPT0oMjQ4JmUpJiYobj1mKCkscj1mKCksbz1mKCksaT0oNyZlKTw8MTh8bjw8MTJ8cjw8NnxvLGk+PTY1NTM2JiZpPD0xMTE0MTExKSlyZXR1cm4gaTt0aHJvdyBFcnJvcihcIkludmFsaWQgVVRGLTggZGV0ZWN0ZWRcIil9ZnVuY3Rpb24gZCh0LGUpe2U9ZXx8e307dmFyIG49ITEhPT1lLnN0cmljdDtnPXModCksdj1nLmxlbmd0aCxiPTA7Zm9yKHZhciByLG89W107KHI9bChuKSkhPT0hMTspby5wdXNoKHIpO3JldHVybiBhKG8pfXZhciB5PVwib2JqZWN0XCI9PXR5cGVvZiBlJiZlLG09KFwib2JqZWN0XCI9PXR5cGVvZiB0JiZ0JiZ0LmV4cG9ydHM9PXkmJnQsXCJvYmplY3RcIj09dHlwZW9mIG8mJm8pO20uZ2xvYmFsIT09bSYmbS53aW5kb3chPT1tfHwoaT1tKTt2YXIgZyx2LGIsdz1TdHJpbmcuZnJvbUNoYXJDb2RlLGs9e3ZlcnNpb246XCIyLjEuMlwiLGVuY29kZTpoLGRlY29kZTpkfTtyPWZ1bmN0aW9uKCl7cmV0dXJuIGt9LmNhbGwoZSxuLGUsdCksISh2b2lkIDAhPT1yJiYodC5leHBvcnRzPXIpKX0odGhpcyl9KS5jYWxsKGUsbigyOCkodCksZnVuY3Rpb24oKXtyZXR1cm4gdGhpc30oKSl9LGZ1bmN0aW9uKHQsZSl7dC5leHBvcnRzPWZ1bmN0aW9uKHQpe3JldHVybiB0LndlYnBhY2tQb2x5ZmlsbHx8KHQuZGVwcmVjYXRlPWZ1bmN0aW9uKCl7fSx0LnBhdGhzPVtdLHQuY2hpbGRyZW49W10sdC53ZWJwYWNrUG9seWZpbGw9MSksdH19LGZ1bmN0aW9uKHQsZSl7IWZ1bmN0aW9uKCl7XCJ1c2Ugc3RyaWN0XCI7Zm9yKHZhciB0PVwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrL1wiLG49bmV3IFVpbnQ4QXJyYXkoMjU2KSxyPTA7cjx0Lmxlbmd0aDtyKyspblt0LmNoYXJDb2RlQXQocildPXI7ZS5lbmNvZGU9ZnVuY3Rpb24oZSl7dmFyIG4scj1uZXcgVWludDhBcnJheShlKSxvPXIubGVuZ3RoLGk9XCJcIjtmb3Iobj0wO248bztuKz0zKWkrPXRbcltuXT4+Ml0saSs9dFsoMyZyW25dKTw8NHxyW24rMV0+PjRdLGkrPXRbKDE1JnJbbisxXSk8PDJ8cltuKzJdPj42XSxpKz10WzYzJnJbbisyXV07cmV0dXJuIG8lMz09PTI/aT1pLnN1YnN0cmluZygwLGkubGVuZ3RoLTEpK1wiPVwiOm8lMz09PTEmJihpPWkuc3Vic3RyaW5nKDAsaS5sZW5ndGgtMikrXCI9PVwiKSxpfSxlLmRlY29kZT1mdW5jdGlvbih0KXt2YXIgZSxyLG8saSxzLGE9Ljc1KnQubGVuZ3RoLGM9dC5sZW5ndGgscD0wO1wiPVwiPT09dFt0Lmxlbmd0aC0xXSYmKGEtLSxcIj1cIj09PXRbdC5sZW5ndGgtMl0mJmEtLSk7dmFyIHU9bmV3IEFycmF5QnVmZmVyKGEpLGg9bmV3IFVpbnQ4QXJyYXkodSk7Zm9yKGU9MDtlPGM7ZSs9NClyPW5bdC5jaGFyQ29kZUF0KGUpXSxvPW5bdC5jaGFyQ29kZUF0KGUrMSldLGk9blt0LmNoYXJDb2RlQXQoZSsyKV0scz1uW3QuY2hhckNvZGVBdChlKzMpXSxoW3ArK109cjw8MnxvPj40LGhbcCsrXT0oMTUmbyk8PDR8aT4+MixoW3ArK109KDMmaSk8PDZ8NjMmcztyZXR1cm4gdX19KCl9LGZ1bmN0aW9uKHQsZSl7KGZ1bmN0aW9uKGUpe2Z1bmN0aW9uIG4odCl7Zm9yKHZhciBlPTA7ZTx0Lmxlbmd0aDtlKyspe3ZhciBuPXRbZV07aWYobi5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcil7dmFyIHI9bi5idWZmZXI7aWYobi5ieXRlTGVuZ3RoIT09ci5ieXRlTGVuZ3RoKXt2YXIgbz1uZXcgVWludDhBcnJheShuLmJ5dGVMZW5ndGgpO28uc2V0KG5ldyBVaW50OEFycmF5KHIsbi5ieXRlT2Zmc2V0LG4uYnl0ZUxlbmd0aCkpLHI9by5idWZmZXJ9dFtlXT1yfX19ZnVuY3Rpb24gcih0LGUpe2U9ZXx8e307dmFyIHI9bmV3IGk7bih0KTtmb3IodmFyIG89MDtvPHQubGVuZ3RoO28rKylyLmFwcGVuZCh0W29dKTtyZXR1cm4gZS50eXBlP3IuZ2V0QmxvYihlLnR5cGUpOnIuZ2V0QmxvYigpfWZ1bmN0aW9uIG8odCxlKXtyZXR1cm4gbih0KSxuZXcgQmxvYih0LGV8fHt9KX12YXIgaT1lLkJsb2JCdWlsZGVyfHxlLldlYktpdEJsb2JCdWlsZGVyfHxlLk1TQmxvYkJ1aWxkZXJ8fGUuTW96QmxvYkJ1aWxkZXIscz1mdW5jdGlvbigpe3RyeXt2YXIgdD1uZXcgQmxvYihbXCJoaVwiXSk7cmV0dXJuIDI9PT10LnNpemV9Y2F0Y2goZSl7cmV0dXJuITF9fSgpLGE9cyYmZnVuY3Rpb24oKXt0cnl7dmFyIHQ9bmV3IEJsb2IoW25ldyBVaW50OEFycmF5KFsxLDJdKV0pO3JldHVybiAyPT09dC5zaXplfWNhdGNoKGUpe3JldHVybiExfX0oKSxjPWkmJmkucHJvdG90eXBlLmFwcGVuZCYmaS5wcm90b3R5cGUuZ2V0QmxvYjt0LmV4cG9ydHM9ZnVuY3Rpb24oKXtyZXR1cm4gcz9hP2UuQmxvYjpvOmM/cjp2b2lkIDB9KCl9KS5jYWxsKGUsZnVuY3Rpb24oKXtyZXR1cm4gdGhpc30oKSl9LGZ1bmN0aW9uKHQsZSl7ZS5lbmNvZGU9ZnVuY3Rpb24odCl7dmFyIGU9XCJcIjtmb3IodmFyIG4gaW4gdCl0Lmhhc093blByb3BlcnR5KG4pJiYoZS5sZW5ndGgmJihlKz1cIiZcIiksZSs9ZW5jb2RlVVJJQ29tcG9uZW50KG4pK1wiPVwiK2VuY29kZVVSSUNvbXBvbmVudCh0W25dKSk7cmV0dXJuIGV9LGUuZGVjb2RlPWZ1bmN0aW9uKHQpe2Zvcih2YXIgZT17fSxuPXQuc3BsaXQoXCImXCIpLHI9MCxvPW4ubGVuZ3RoO3I8bztyKyspe3ZhciBpPW5bcl0uc3BsaXQoXCI9XCIpO2VbZGVjb2RlVVJJQ29tcG9uZW50KGlbMF0pXT1kZWNvZGVVUklDb21wb25lbnQoaVsxXSl9cmV0dXJuIGV9fSxmdW5jdGlvbih0LGUpe3QuZXhwb3J0cz1mdW5jdGlvbih0LGUpe3ZhciBuPWZ1bmN0aW9uKCl7fTtuLnByb3RvdHlwZT1lLnByb3RvdHlwZSx0LnByb3RvdHlwZT1uZXcgbix0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvcj10fX0sZnVuY3Rpb24odCxlKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBuKHQpe3ZhciBlPVwiXCI7ZG8gZT1zW3QlYV0rZSx0PU1hdGguZmxvb3IodC9hKTt3aGlsZSh0PjApO3JldHVybiBlfWZ1bmN0aW9uIHIodCl7dmFyIGU9MDtmb3IodT0wO3U8dC5sZW5ndGg7dSsrKWU9ZSphK2NbdC5jaGFyQXQodSldO3JldHVybiBlfWZ1bmN0aW9uIG8oKXt2YXIgdD1uKCtuZXcgRGF0ZSk7cmV0dXJuIHQhPT1pPyhwPTAsaT10KTp0K1wiLlwiK24ocCsrKX1mb3IodmFyIGkscz1cIjAxMjM0NTY3ODlBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6LV9cIi5zcGxpdChcIlwiKSxhPTY0LGM9e30scD0wLHU9MDt1PGE7dSsrKWNbc1t1XV09dTtvLmVuY29kZT1uLG8uZGVjb2RlPXIsdC5leHBvcnRzPW99LGZ1bmN0aW9uKHQsZSxuKXsoZnVuY3Rpb24oZSl7ZnVuY3Rpb24gcigpe31mdW5jdGlvbiBvKHQpe2kuY2FsbCh0aGlzLHQpLHRoaXMucXVlcnk9dGhpcy5xdWVyeXx8e30sYXx8KGUuX19fZWlvfHwoZS5fX19laW89W10pLGE9ZS5fX19laW8pLHRoaXMuaW5kZXg9YS5sZW5ndGg7dmFyIG49dGhpczthLnB1c2goZnVuY3Rpb24odCl7bi5vbkRhdGEodCl9KSx0aGlzLnF1ZXJ5Lmo9dGhpcy5pbmRleCxlLmRvY3VtZW50JiZlLmFkZEV2ZW50TGlzdGVuZXImJmUuYWRkRXZlbnRMaXN0ZW5lcihcImJlZm9yZXVubG9hZFwiLGZ1bmN0aW9uKCl7bi5zY3JpcHQmJihuLnNjcmlwdC5vbmVycm9yPXIpfSwhMSl9dmFyIGk9bigyMSkscz1uKDMyKTt0LmV4cG9ydHM9bzt2YXIgYSxjPS9cXG4vZyxwPS9cXFxcbi9nO3MobyxpKSxvLnByb3RvdHlwZS5zdXBwb3J0c0JpbmFyeT0hMSxvLnByb3RvdHlwZS5kb0Nsb3NlPWZ1bmN0aW9uKCl7dGhpcy5zY3JpcHQmJih0aGlzLnNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuc2NyaXB0KSx0aGlzLnNjcmlwdD1udWxsKSx0aGlzLmZvcm0mJih0aGlzLmZvcm0ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmZvcm0pLHRoaXMuZm9ybT1udWxsLHRoaXMuaWZyYW1lPW51bGwpLGkucHJvdG90eXBlLmRvQ2xvc2UuY2FsbCh0aGlzKX0sby5wcm90b3R5cGUuZG9Qb2xsPWZ1bmN0aW9uKCl7dmFyIHQ9dGhpcyxlPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7dGhpcy5zY3JpcHQmJih0aGlzLnNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuc2NyaXB0KSx0aGlzLnNjcmlwdD1udWxsKSxlLmFzeW5jPSEwLGUuc3JjPXRoaXMudXJpKCksZS5vbmVycm9yPWZ1bmN0aW9uKGUpe3Qub25FcnJvcihcImpzb25wIHBvbGwgZXJyb3JcIixlKX07dmFyIG49ZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzY3JpcHRcIilbMF07bj9uLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGUsbik6KGRvY3VtZW50LmhlYWR8fGRvY3VtZW50LmJvZHkpLmFwcGVuZENoaWxkKGUpLHRoaXMuc2NyaXB0PWU7dmFyIHI9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIG5hdmlnYXRvciYmL2dlY2tvL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtyJiZzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7dmFyIHQ9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlmcmFtZVwiKTtkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHQpLGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodCl9LDEwMCl9LG8ucHJvdG90eXBlLmRvV3JpdGU9ZnVuY3Rpb24odCxlKXtmdW5jdGlvbiBuKCl7cigpLGUoKX1mdW5jdGlvbiByKCl7aWYoby5pZnJhbWUpdHJ5e28uZm9ybS5yZW1vdmVDaGlsZChvLmlmcmFtZSl9Y2F0Y2godCl7by5vbkVycm9yKFwianNvbnAgcG9sbGluZyBpZnJhbWUgcmVtb3ZhbCBlcnJvclwiLHQpfXRyeXt2YXIgZT0nPGlmcmFtZSBzcmM9XCJqYXZhc2NyaXB0OjBcIiBuYW1lPVwiJytvLmlmcmFtZUlkKydcIj4nO2k9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChlKX1jYXRjaCh0KXtpPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpZnJhbWVcIiksaS5uYW1lPW8uaWZyYW1lSWQsaS5zcmM9XCJqYXZhc2NyaXB0OjBcIn1pLmlkPW8uaWZyYW1lSWQsby5mb3JtLmFwcGVuZENoaWxkKGkpLG8uaWZyYW1lPWl9dmFyIG89dGhpcztpZighdGhpcy5mb3JtKXt2YXIgaSxzPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJmb3JtXCIpLGE9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRleHRhcmVhXCIpLHU9dGhpcy5pZnJhbWVJZD1cImVpb19pZnJhbWVfXCIrdGhpcy5pbmRleDtzLmNsYXNzTmFtZT1cInNvY2tldGlvXCIscy5zdHlsZS5wb3NpdGlvbj1cImFic29sdXRlXCIscy5zdHlsZS50b3A9XCItMTAwMHB4XCIscy5zdHlsZS5sZWZ0PVwiLTEwMDBweFwiLHMudGFyZ2V0PXUscy5tZXRob2Q9XCJQT1NUXCIscy5zZXRBdHRyaWJ1dGUoXCJhY2NlcHQtY2hhcnNldFwiLFwidXRmLThcIiksYS5uYW1lPVwiZFwiLHMuYXBwZW5kQ2hpbGQoYSksZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChzKSx0aGlzLmZvcm09cyx0aGlzLmFyZWE9YX10aGlzLmZvcm0uYWN0aW9uPXRoaXMudXJpKCkscigpLHQ9dC5yZXBsYWNlKHAsXCJcXFxcXFxuXCIpLHRoaXMuYXJlYS52YWx1ZT10LnJlcGxhY2UoYyxcIlxcXFxuXCIpO3RyeXt0aGlzLmZvcm0uc3VibWl0KCl9Y2F0Y2goaCl7fXRoaXMuaWZyYW1lLmF0dGFjaEV2ZW50P3RoaXMuaWZyYW1lLm9ucmVhZHlzdGF0ZWNoYW5nZT1mdW5jdGlvbigpe1wiY29tcGxldGVcIj09PW8uaWZyYW1lLnJlYWR5U3RhdGUmJm4oKX06dGhpcy5pZnJhbWUub25sb2FkPW59fSkuY2FsbChlLGZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9KCkpfSxmdW5jdGlvbih0LGUsbil7KGZ1bmN0aW9uKGUpe2Z1bmN0aW9uIHIodCl7dmFyIGU9dCYmdC5mb3JjZUJhc2U2NDtlJiYodGhpcy5zdXBwb3J0c0JpbmFyeT0hMSksdGhpcy5wZXJNZXNzYWdlRGVmbGF0ZT10LnBlck1lc3NhZ2VEZWZsYXRlLHRoaXMudXNpbmdCcm93c2VyV2ViU29ja2V0PWgmJiF0LmZvcmNlTm9kZSx0aGlzLnByb3RvY29scz10LnByb3RvY29scyx0aGlzLnVzaW5nQnJvd3NlcldlYlNvY2tldHx8KGw9byksaS5jYWxsKHRoaXMsdCl9dmFyIG8saT1uKDIyKSxzPW4oMjMpLGE9bigzMSksYz1uKDMyKSxwPW4oMzMpLHU9bigzKShcImVuZ2luZS5pby1jbGllbnQ6d2Vic29ja2V0XCIpLGg9ZS5XZWJTb2NrZXR8fGUuTW96V2ViU29ja2V0O2lmKFwidW5kZWZpbmVkXCI9PXR5cGVvZiB3aW5kb3cpdHJ5e289bigzNil9Y2F0Y2goZil7fXZhciBsPWg7bHx8XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvd3x8KGw9byksdC5leHBvcnRzPXIsYyhyLGkpLHIucHJvdG90eXBlLm5hbWU9XCJ3ZWJzb2NrZXRcIixyLnByb3RvdHlwZS5zdXBwb3J0c0JpbmFyeT0hMCxyLnByb3RvdHlwZS5kb09wZW49ZnVuY3Rpb24oKXtpZih0aGlzLmNoZWNrKCkpe3ZhciB0PXRoaXMudXJpKCksZT10aGlzLnByb3RvY29scyxuPXthZ2VudDp0aGlzLmFnZW50LHBlck1lc3NhZ2VEZWZsYXRlOnRoaXMucGVyTWVzc2FnZURlZmxhdGV9O24ucGZ4PXRoaXMucGZ4LG4ua2V5PXRoaXMua2V5LG4ucGFzc3BocmFzZT10aGlzLnBhc3NwaHJhc2Usbi5jZXJ0PXRoaXMuY2VydCxuLmNhPXRoaXMuY2Esbi5jaXBoZXJzPXRoaXMuY2lwaGVycyxuLnJlamVjdFVuYXV0aG9yaXplZD10aGlzLnJlamVjdFVuYXV0aG9yaXplZCx0aGlzLmV4dHJhSGVhZGVycyYmKG4uaGVhZGVycz10aGlzLmV4dHJhSGVhZGVycyksdGhpcy5sb2NhbEFkZHJlc3MmJihuLmxvY2FsQWRkcmVzcz10aGlzLmxvY2FsQWRkcmVzcyk7dHJ5e3RoaXMud3M9dGhpcy51c2luZ0Jyb3dzZXJXZWJTb2NrZXQ/ZT9uZXcgbCh0LGUpOm5ldyBsKHQpOm5ldyBsKHQsZSxuKX1jYXRjaChyKXtyZXR1cm4gdGhpcy5lbWl0KFwiZXJyb3JcIixyKX12b2lkIDA9PT10aGlzLndzLmJpbmFyeVR5cGUmJih0aGlzLnN1cHBvcnRzQmluYXJ5PSExKSx0aGlzLndzLnN1cHBvcnRzJiZ0aGlzLndzLnN1cHBvcnRzLmJpbmFyeT8odGhpcy5zdXBwb3J0c0JpbmFyeT0hMCx0aGlzLndzLmJpbmFyeVR5cGU9XCJub2RlYnVmZmVyXCIpOnRoaXMud3MuYmluYXJ5VHlwZT1cImFycmF5YnVmZmVyXCIsdGhpcy5hZGRFdmVudExpc3RlbmVycygpfX0sci5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcnM9ZnVuY3Rpb24oKXt2YXIgdD10aGlzO3RoaXMud3Mub25vcGVuPWZ1bmN0aW9uKCl7dC5vbk9wZW4oKX0sdGhpcy53cy5vbmNsb3NlPWZ1bmN0aW9uKCl7dC5vbkNsb3NlKCl9LHRoaXMud3Mub25tZXNzYWdlPWZ1bmN0aW9uKGUpe3Qub25EYXRhKGUuZGF0YSl9LHRoaXMud3Mub25lcnJvcj1mdW5jdGlvbihlKXt0Lm9uRXJyb3IoXCJ3ZWJzb2NrZXQgZXJyb3JcIixlKX19LHIucHJvdG90eXBlLndyaXRlPWZ1bmN0aW9uKHQpe2Z1bmN0aW9uIG4oKXtyLmVtaXQoXCJmbHVzaFwiKSxzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7ci53cml0YWJsZT0hMCxyLmVtaXQoXCJkcmFpblwiKX0sMCl9dmFyIHI9dGhpczt0aGlzLndyaXRhYmxlPSExO2Zvcih2YXIgbz10Lmxlbmd0aCxpPTAsYT1vO2k8YTtpKyspIWZ1bmN0aW9uKHQpe3MuZW5jb2RlUGFja2V0KHQsci5zdXBwb3J0c0JpbmFyeSxmdW5jdGlvbihpKXtpZighci51c2luZ0Jyb3dzZXJXZWJTb2NrZXQpe3ZhciBzPXt9O2lmKHQub3B0aW9ucyYmKHMuY29tcHJlc3M9dC5vcHRpb25zLmNvbXByZXNzKSxyLnBlck1lc3NhZ2VEZWZsYXRlKXt2YXIgYT1cInN0cmluZ1wiPT10eXBlb2YgaT9lLkJ1ZmZlci5ieXRlTGVuZ3RoKGkpOmkubGVuZ3RoO2E8ci5wZXJNZXNzYWdlRGVmbGF0ZS50aHJlc2hvbGQmJihzLmNvbXByZXNzPSExKX19dHJ5e3IudXNpbmdCcm93c2VyV2ViU29ja2V0P3Iud3Muc2VuZChpKTpyLndzLnNlbmQoaSxzKX1jYXRjaChjKXt1KFwid2Vic29ja2V0IGNsb3NlZCBiZWZvcmUgb25jbG9zZSBldmVudFwiKX0tLW98fG4oKX0pfSh0W2ldKX0sci5wcm90b3R5cGUub25DbG9zZT1mdW5jdGlvbigpe2kucHJvdG90eXBlLm9uQ2xvc2UuY2FsbCh0aGlzKX0sci5wcm90b3R5cGUuZG9DbG9zZT1mdW5jdGlvbigpe1widW5kZWZpbmVkXCIhPXR5cGVvZiB0aGlzLndzJiZ0aGlzLndzLmNsb3NlKCl9LHIucHJvdG90eXBlLnVyaT1mdW5jdGlvbigpe3ZhciB0PXRoaXMucXVlcnl8fHt9LGU9dGhpcy5zZWN1cmU/XCJ3c3NcIjpcIndzXCIsbj1cIlwiO3RoaXMucG9ydCYmKFwid3NzXCI9PT1lJiY0NDMhPT1OdW1iZXIodGhpcy5wb3J0KXx8XCJ3c1wiPT09ZSYmODAhPT1OdW1iZXIodGhpcy5wb3J0KSkmJihuPVwiOlwiK3RoaXMucG9ydCksdGhpcy50aW1lc3RhbXBSZXF1ZXN0cyYmKHRbdGhpcy50aW1lc3RhbXBQYXJhbV09cCgpKSx0aGlzLnN1cHBvcnRzQmluYXJ5fHwodC5iNjQ9MSksdD1hLmVuY29kZSh0KSx0Lmxlbmd0aCYmKHQ9XCI/XCIrdCk7dmFyIHI9dGhpcy5ob3N0bmFtZS5pbmRleE9mKFwiOlwiKSE9PS0xO3JldHVybiBlK1wiOi8vXCIrKHI/XCJbXCIrdGhpcy5ob3N0bmFtZStcIl1cIjp0aGlzLmhvc3RuYW1lKStuK3RoaXMucGF0aCt0fSxyLnByb3RvdHlwZS5jaGVjaz1mdW5jdGlvbigpe3JldHVybiEoIWx8fFwiX19pbml0aWFsaXplXCJpbiBsJiZ0aGlzLm5hbWU9PT1yLnByb3RvdHlwZS5uYW1lKX19KS5jYWxsKGUsZnVuY3Rpb24oKXtyZXR1cm4gdGhpc30oKSl9LGZ1bmN0aW9uKHQsZSl7fSxmdW5jdGlvbih0LGUpe3ZhciBuPVtdLmluZGV4T2Y7dC5leHBvcnRzPWZ1bmN0aW9uKHQsZSl7aWYobilyZXR1cm4gdC5pbmRleE9mKGUpO2Zvcih2YXIgcj0wO3I8dC5sZW5ndGg7KytyKWlmKHRbcl09PT1lKXJldHVybiByO3JldHVybi0xfX0sZnVuY3Rpb24odCxlKXsoZnVuY3Rpb24oZSl7dmFyIG49L15bXFxdLDp7fVxcc10qJC8scj0vXFxcXCg/OltcIlxcXFxcXC9iZm5ydF18dVswLTlhLWZBLUZdezR9KS9nLG89L1wiW15cIlxcXFxcXG5cXHJdKlwifHRydWV8ZmFsc2V8bnVsbHwtP1xcZCsoPzpcXC5cXGQqKT8oPzpbZUVdWytcXC1dP1xcZCspPy9nLGk9Lyg/Ol58OnwsKSg/OlxccypcXFspKy9nLHM9L15cXHMrLyxhPS9cXHMrJC87dC5leHBvcnRzPWZ1bmN0aW9uKHQpe3JldHVyblwic3RyaW5nXCI9PXR5cGVvZiB0JiZ0Pyh0PXQucmVwbGFjZShzLFwiXCIpLnJlcGxhY2UoYSxcIlwiKSxlLkpTT04mJkpTT04ucGFyc2U/SlNPTi5wYXJzZSh0KTpuLnRlc3QodC5yZXBsYWNlKHIsXCJAXCIpLnJlcGxhY2UobyxcIl1cIikucmVwbGFjZShpLFwiXCIpKT9uZXcgRnVuY3Rpb24oXCJyZXR1cm4gXCIrdCkoKTp2b2lkIDApOm51bGx9fSkuY2FsbChlLGZ1bmN0aW9uKCl7cmV0dXJuIHRoaXN9KCkpfSxmdW5jdGlvbih0LGUsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gcih0LGUsbil7dGhpcy5pbz10LHRoaXMubnNwPWUsdGhpcy5qc29uPXRoaXMsdGhpcy5pZHM9MCx0aGlzLmFja3M9e30sdGhpcy5yZWNlaXZlQnVmZmVyPVtdLHRoaXMuc2VuZEJ1ZmZlcj1bXSx0aGlzLmNvbm5lY3RlZD0hMSx0aGlzLmRpc2Nvbm5lY3RlZD0hMCxuJiZuLnF1ZXJ5JiYodGhpcy5xdWVyeT1uLnF1ZXJ5KSx0aGlzLmlvLmF1dG9Db25uZWN0JiZ0aGlzLm9wZW4oKX12YXIgbz1cImZ1bmN0aW9uXCI9PXR5cGVvZiBTeW1ib2wmJlwic3ltYm9sXCI9PXR5cGVvZiBTeW1ib2wuaXRlcmF0b3I/ZnVuY3Rpb24odCl7cmV0dXJuIHR5cGVvZiB0fTpmdW5jdGlvbih0KXtyZXR1cm4gdCYmXCJmdW5jdGlvblwiPT10eXBlb2YgU3ltYm9sJiZ0LmNvbnN0cnVjdG9yPT09U3ltYm9sJiZ0IT09U3ltYm9sLnByb3RvdHlwZT9cInN5bWJvbFwiOnR5cGVvZiB0fSxpPW4oNykscz1uKDgpLGE9big0MCksYz1uKDQxKSxwPW4oNDIpLHU9bigzKShcInNvY2tldC5pby1jbGllbnQ6c29ja2V0XCIpLGg9bigzMSk7dC5leHBvcnRzPWU9cjt2YXIgZj17Y29ubmVjdDoxLGNvbm5lY3RfZXJyb3I6MSxjb25uZWN0X3RpbWVvdXQ6MSxjb25uZWN0aW5nOjEsZGlzY29ubmVjdDoxLGVycm9yOjEscmVjb25uZWN0OjEscmVjb25uZWN0X2F0dGVtcHQ6MSxyZWNvbm5lY3RfZmFpbGVkOjEscmVjb25uZWN0X2Vycm9yOjEscmVjb25uZWN0aW5nOjEscGluZzoxLHBvbmc6MX0sbD1zLnByb3RvdHlwZS5lbWl0O3Moci5wcm90b3R5cGUpLHIucHJvdG90eXBlLnN1YkV2ZW50cz1mdW5jdGlvbigpe2lmKCF0aGlzLnN1YnMpe3ZhciB0PXRoaXMuaW87dGhpcy5zdWJzPVtjKHQsXCJvcGVuXCIscCh0aGlzLFwib25vcGVuXCIpKSxjKHQsXCJwYWNrZXRcIixwKHRoaXMsXCJvbnBhY2tldFwiKSksYyh0LFwiY2xvc2VcIixwKHRoaXMsXCJvbmNsb3NlXCIpKV19fSxyLnByb3RvdHlwZS5vcGVuPXIucHJvdG90eXBlLmNvbm5lY3Q9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5jb25uZWN0ZWQ/dGhpczoodGhpcy5zdWJFdmVudHMoKSx0aGlzLmlvLm9wZW4oKSxcIm9wZW5cIj09PXRoaXMuaW8ucmVhZHlTdGF0ZSYmdGhpcy5vbm9wZW4oKSx0aGlzLmVtaXQoXCJjb25uZWN0aW5nXCIpLHRoaXMpfSxyLnByb3RvdHlwZS5zZW5kPWZ1bmN0aW9uKCl7dmFyIHQ9YShhcmd1bWVudHMpO3JldHVybiB0LnVuc2hpZnQoXCJtZXNzYWdlXCIpLHRoaXMuZW1pdC5hcHBseSh0aGlzLHQpLHRoaXN9LHIucHJvdG90eXBlLmVtaXQ9ZnVuY3Rpb24odCl7aWYoZi5oYXNPd25Qcm9wZXJ0eSh0KSlyZXR1cm4gbC5hcHBseSh0aGlzLGFyZ3VtZW50cyksdGhpczt2YXIgZT1hKGFyZ3VtZW50cyksbj17dHlwZTppLkVWRU5ULGRhdGE6ZX07cmV0dXJuIG4ub3B0aW9ucz17fSxuLm9wdGlvbnMuY29tcHJlc3M9IXRoaXMuZmxhZ3N8fCExIT09dGhpcy5mbGFncy5jb21wcmVzcyxcImZ1bmN0aW9uXCI9PXR5cGVvZiBlW2UubGVuZ3RoLTFdJiYodShcImVtaXR0aW5nIHBhY2tldCB3aXRoIGFjayBpZCAlZFwiLHRoaXMuaWRzKSx0aGlzLmFja3NbdGhpcy5pZHNdPWUucG9wKCksbi5pZD10aGlzLmlkcysrKSx0aGlzLmNvbm5lY3RlZD90aGlzLnBhY2tldChuKTp0aGlzLnNlbmRCdWZmZXIucHVzaChuKSxkZWxldGUgdGhpcy5mbGFncyx0aGlzfSxyLnByb3RvdHlwZS5wYWNrZXQ9ZnVuY3Rpb24odCl7dC5uc3A9dGhpcy5uc3AsdGhpcy5pby5wYWNrZXQodCl9LHIucHJvdG90eXBlLm9ub3Blbj1mdW5jdGlvbigpe2lmKHUoXCJ0cmFuc3BvcnQgaXMgb3BlbiAtIGNvbm5lY3RpbmdcIiksXCIvXCIhPT10aGlzLm5zcClpZih0aGlzLnF1ZXJ5KXt2YXIgdD1cIm9iamVjdFwiPT09byh0aGlzLnF1ZXJ5KT9oLmVuY29kZSh0aGlzLnF1ZXJ5KTp0aGlzLnF1ZXJ5O3UoXCJzZW5kaW5nIGNvbm5lY3QgcGFja2V0IHdpdGggcXVlcnkgJXNcIix0KSx0aGlzLnBhY2tldCh7dHlwZTppLkNPTk5FQ1QscXVlcnk6dH0pfWVsc2UgdGhpcy5wYWNrZXQoe3R5cGU6aS5DT05ORUNUfSl9LHIucHJvdG90eXBlLm9uY2xvc2U9ZnVuY3Rpb24odCl7dShcImNsb3NlICglcylcIix0KSx0aGlzLmNvbm5lY3RlZD0hMSx0aGlzLmRpc2Nvbm5lY3RlZD0hMCxkZWxldGUgdGhpcy5pZCx0aGlzLmVtaXQoXCJkaXNjb25uZWN0XCIsdCl9LHIucHJvdG90eXBlLm9ucGFja2V0PWZ1bmN0aW9uKHQpe2lmKHQubnNwPT09dGhpcy5uc3Apc3dpdGNoKHQudHlwZSl7Y2FzZSBpLkNPTk5FQ1Q6dGhpcy5vbmNvbm5lY3QoKTticmVhaztjYXNlIGkuRVZFTlQ6dGhpcy5vbmV2ZW50KHQpO2JyZWFrO2Nhc2UgaS5CSU5BUllfRVZFTlQ6dGhpcy5vbmV2ZW50KHQpO2JyZWFrO2Nhc2UgaS5BQ0s6dGhpcy5vbmFjayh0KTticmVhaztjYXNlIGkuQklOQVJZX0FDSzp0aGlzLm9uYWNrKHQpO2JyZWFrO2Nhc2UgaS5ESVNDT05ORUNUOnRoaXMub25kaXNjb25uZWN0KCk7YnJlYWs7Y2FzZSBpLkVSUk9SOnRoaXMuZW1pdChcImVycm9yXCIsdC5kYXRhKX19LHIucHJvdG90eXBlLm9uZXZlbnQ9ZnVuY3Rpb24odCl7dmFyIGU9dC5kYXRhfHxbXTt1KFwiZW1pdHRpbmcgZXZlbnQgJWpcIixlKSxudWxsIT10LmlkJiYodShcImF0dGFjaGluZyBhY2sgY2FsbGJhY2sgdG8gZXZlbnRcIiksZS5wdXNoKHRoaXMuYWNrKHQuaWQpKSksdGhpcy5jb25uZWN0ZWQ/bC5hcHBseSh0aGlzLGUpOnRoaXMucmVjZWl2ZUJ1ZmZlci5wdXNoKGUpfSxyLnByb3RvdHlwZS5hY2s9ZnVuY3Rpb24odCl7dmFyIGU9dGhpcyxuPSExO3JldHVybiBmdW5jdGlvbigpe2lmKCFuKXtuPSEwO3ZhciByPWEoYXJndW1lbnRzKTt1KFwic2VuZGluZyBhY2sgJWpcIixyKSxlLnBhY2tldCh7dHlwZTppLkFDSyxpZDp0LGRhdGE6cn0pfX19LHIucHJvdG90eXBlLm9uYWNrPWZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuYWNrc1t0LmlkXTtcImZ1bmN0aW9uXCI9PXR5cGVvZiBlPyh1KFwiY2FsbGluZyBhY2sgJXMgd2l0aCAlalwiLHQuaWQsdC5kYXRhKSxlLmFwcGx5KHRoaXMsdC5kYXRhKSxkZWxldGUgdGhpcy5hY2tzW3QuaWRdKTp1KFwiYmFkIGFjayAlc1wiLHQuaWQpfSxyLnByb3RvdHlwZS5vbmNvbm5lY3Q9ZnVuY3Rpb24oKXt0aGlzLmNvbm5lY3RlZD0hMCx0aGlzLmRpc2Nvbm5lY3RlZD0hMSx0aGlzLmVtaXQoXCJjb25uZWN0XCIpLHRoaXMuZW1pdEJ1ZmZlcmVkKCl9LHIucHJvdG90eXBlLmVtaXRCdWZmZXJlZD1mdW5jdGlvbigpe3ZhciB0O2Zvcih0PTA7dDx0aGlzLnJlY2VpdmVCdWZmZXIubGVuZ3RoO3QrKylsLmFwcGx5KHRoaXMsdGhpcy5yZWNlaXZlQnVmZmVyW3RdKTtmb3IodGhpcy5yZWNlaXZlQnVmZmVyPVtdLHQ9MDt0PHRoaXMuc2VuZEJ1ZmZlci5sZW5ndGg7dCsrKXRoaXMucGFja2V0KHRoaXMuc2VuZEJ1ZmZlclt0XSk7dGhpcy5zZW5kQnVmZmVyPVtdfSxyLnByb3RvdHlwZS5vbmRpc2Nvbm5lY3Q9ZnVuY3Rpb24oKXt1KFwic2VydmVyIGRpc2Nvbm5lY3QgKCVzKVwiLHRoaXMubnNwKSx0aGlzLmRlc3Ryb3koKSx0aGlzLm9uY2xvc2UoXCJpbyBzZXJ2ZXIgZGlzY29ubmVjdFwiKX0sci5wcm90b3R5cGUuZGVzdHJveT1mdW5jdGlvbigpe2lmKHRoaXMuc3Vicyl7Zm9yKHZhciB0PTA7dDx0aGlzLnN1YnMubGVuZ3RoO3QrKyl0aGlzLnN1YnNbdF0uZGVzdHJveSgpO3RoaXMuc3Vicz1udWxsfXRoaXMuaW8uZGVzdHJveSh0aGlzKX0sci5wcm90b3R5cGUuY2xvc2U9ci5wcm90b3R5cGUuZGlzY29ubmVjdD1mdW5jdGlvbigpe3JldHVybiB0aGlzLmNvbm5lY3RlZCYmKHUoXCJwZXJmb3JtaW5nIGRpc2Nvbm5lY3QgKCVzKVwiLHRoaXMubnNwKSx0aGlzLnBhY2tldCh7dHlwZTppLkRJU0NPTk5FQ1R9KSksdGhpcy5kZXN0cm95KCksdGhpcy5jb25uZWN0ZWQmJnRoaXMub25jbG9zZShcImlvIGNsaWVudCBkaXNjb25uZWN0XCIpLHRoaXN9LHIucHJvdG90eXBlLmNvbXByZXNzPWZ1bmN0aW9uKHQpe3JldHVybiB0aGlzLmZsYWdzPXRoaXMuZmxhZ3N8fHt9LHRoaXMuZmxhZ3MuY29tcHJlc3M9dCx0aGlzfX0sZnVuY3Rpb24odCxlKXtmdW5jdGlvbiBuKHQsZSl7dmFyIG49W107ZT1lfHwwO2Zvcih2YXIgcj1lfHwwO3I8dC5sZW5ndGg7cisrKW5bci1lXT10W3JdO3JldHVybiBufXQuZXhwb3J0cz1ufSxmdW5jdGlvbih0LGUpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIG4odCxlLG4pe3JldHVybiB0Lm9uKGUsbikse2Rlc3Ryb3k6ZnVuY3Rpb24oKXt0LnJlbW92ZUxpc3RlbmVyKGUsbil9fX10LmV4cG9ydHM9bn0sZnVuY3Rpb24odCxlKXt2YXIgbj1bXS5zbGljZTt0LmV4cG9ydHM9ZnVuY3Rpb24odCxlKXtpZihcInN0cmluZ1wiPT10eXBlb2YgZSYmKGU9dFtlXSksXCJmdW5jdGlvblwiIT10eXBlb2YgZSl0aHJvdyBuZXcgRXJyb3IoXCJiaW5kKCkgcmVxdWlyZXMgYSBmdW5jdGlvblwiKTt2YXIgcj1uLmNhbGwoYXJndW1lbnRzLDIpO3JldHVybiBmdW5jdGlvbigpe3JldHVybiBlLmFwcGx5KHQsci5jb25jYXQobi5jYWxsKGFyZ3VtZW50cykpKX19fSxmdW5jdGlvbih0LGUpe2Z1bmN0aW9uIG4odCl7dD10fHx7fSx0aGlzLm1zPXQubWlufHwxMDAsdGhpcy5tYXg9dC5tYXh8fDFlNCx0aGlzLmZhY3Rvcj10LmZhY3Rvcnx8Mix0aGlzLmppdHRlcj10LmppdHRlcj4wJiZ0LmppdHRlcjw9MT90LmppdHRlcjowLHRoaXMuYXR0ZW1wdHM9MH10LmV4cG9ydHM9bixuLnByb3RvdHlwZS5kdXJhdGlvbj1mdW5jdGlvbigpe3ZhciB0PXRoaXMubXMqTWF0aC5wb3codGhpcy5mYWN0b3IsdGhpcy5hdHRlbXB0cysrKTtpZih0aGlzLmppdHRlcil7dmFyIGU9TWF0aC5yYW5kb20oKSxuPU1hdGguZmxvb3IoZSp0aGlzLmppdHRlcip0KTt0PTA9PSgxJk1hdGguZmxvb3IoMTAqZSkpP3Qtbjp0K259cmV0dXJuIDB8TWF0aC5taW4odCx0aGlzLm1heCl9LG4ucHJvdG90eXBlLnJlc2V0PWZ1bmN0aW9uKCl7dGhpcy5hdHRlbXB0cz0wfSxuLnByb3RvdHlwZS5zZXRNaW49ZnVuY3Rpb24odCl7dGhpcy5tcz10fSxuLnByb3RvdHlwZS5zZXRNYXg9ZnVuY3Rpb24odCl7dGhpcy5tYXg9dH0sbi5wcm90b3R5cGUuc2V0Sml0dGVyPWZ1bmN0aW9uKHQpe3RoaXMuaml0dGVyPXR9fV0pfSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zb2NrZXQuaW8uanMubWFwIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgcmFuZG9tSWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIChNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KSArICcwMDAwMDAwMDAwMDAwMDAwMDAwJykuc3Vic3RyKDIsIDE2KTtcbiAgICB9LFxuICAgIGV4dGVuZDogZnVuY3Rpb24oZGVzdCwgc291cmNlKSB7XG4gICAgICAgIHNvdXJjZSA9IHNvdXJjZSB8fCB7fTtcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZihzb3VyY2UuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIGRlc3Rba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZXN0O1xuICAgIH0sXG4gICAgcmFuZE9wdGlvbnM6ZnVuY3Rpb24gKG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gb3B0aW9uc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBvcHRpb25zLmxlbmd0aCldO1xuICAgIH1cblxufSJdfQ==
