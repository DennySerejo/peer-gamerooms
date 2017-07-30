module.exports = config => {
    config.set({
        frameworks: ['ava'],
        files: [
            'test/browser/**/*.js',
        ],
        exclude:[
            'test/browser/**/_*.js',
        ],
        browsers: ['Chrome']
    });
};