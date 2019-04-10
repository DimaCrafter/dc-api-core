const fs = require('fs');
const log = require('./log');
const cfgArg = process.argv.indexOf('--cfg');

let configPath = process.cwd() + '/config.json';
if(cfgArg !== -1) {
    configPath = process.argv[cfgArg + 1];
    if(!configPath.startsWith('/')) configPath = process.cwd() + '/' + configPath;
}

const config = JSON.parse(fs.readFileSync(configPath));
if ('devMode' in config) log.warn('Config property `devMode` is deprecated, use nodemon instead\nhttps://github.com/remy/nodemon');
config.port = config.port || 8081;
config.ignore = config.ignore || [];

if (config.session) {
    config.session.ttl = config.session.ttl || '3d';
}
module.exports = config;
