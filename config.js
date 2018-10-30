const fs = require('fs');
const path = require('path');

const cfgArg = process.argv.indexOf('--cfg');
let configPath = process.cwd() + '/config.json';
if(cfgArg !== -1) {
    configPath = process.argv[cfgArg + 1];
    if(!configPath.startsWith('/')) configPath = process.cwd() + '/' + configPath;
}
let config = JSON.parse(fs.readFileSync(configPath));
if(config.ssl) {
    if(!config.ssl.cert.startsWith('/')) config.ssl.cert = path.dirname(configPath) + '/' + config.ssl.cert;
    if(!config.ssl.key.startsWith('/'))  config.ssl.key  = path.dirname(configPath) + '/' + config.ssl.key;
}
module.exports = config;