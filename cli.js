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
    
    console.log('API was restarted after changing any .js or .json files');
    console.log('You can submit `rs` to restart manually');
    nodemon.on('start', () => console.log('\nStarting API...'));
} else {
    require('.');
}
