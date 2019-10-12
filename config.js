const fs = require('fs');
const log = require('./log');
const cfgArg = process.argv.indexOf('--cfg');

let configPath = process.cwd() + '/config';
if(cfgArg !== -1) {
    configPath = process.argv[cfgArg + 1];
    if(!configPath.startsWith('/')) configPath = process.cwd() + '/' + configPath;
}

delete require.cache[configPath];
const config = require(configPath);
if ('devMode' in config) log.warn('Config property `devMode` is deprecated, use CLI instead');
config.port = config.port || 8081;
config.isDev = process.argv.indexOf('--dev') !== -1;

if (config.dev && config.isDev) {
    (function merge (target, source) {
        Object.keys(source).forEach(key => {
            if (typeof source[key] === 'object') {
                if (!target[key]) target[key] = {};
                merge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        });
    })(config, config.dev);
    delete config.dev;
}

config.ignore = config.ignore || [];
if (config.session) config.session.ttl = config.session.ttl || '3d';
module.exports = config;
