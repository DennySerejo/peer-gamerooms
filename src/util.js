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