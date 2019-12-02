#!/usr/bin/env node
const config = require('./config');
if (config.isDev) {
    const nodemon = require('nodemon');
    nodemon({
        ext: 'js json',
        script: __dirname + '/index.js',
        args: process.argv.slice(2),
        ignore: config.ignore
    });
    
    console.log('API will be restarted after saving any .js or .json files');
    console.log('You can submit `rs` to restart server manually');
    nodemon.on('start', () => console.log('\nStarting API server...'));
} else {
    require('.');
}
