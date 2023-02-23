const Path = require('path');
const ms = require('ms');
const { mergeObj } = require('./utils');
const configArgIndex = process.argv.indexOf('--cfg');

function proceedConfig (config) {
    config.port = config.port || 8081;
    config.isDev = process.argv.indexOf('--dev') !== -1;

    if (config.isDev) {
        if (config.dev) {
            mergeObj(config, config.dev);
        }

        config.ignore = config.ignore || [];
        if (!~config.ignore.indexOf('node_modules')) config.ignore.push('node_modules');
    }

    if (config.session) {
        config.session.ttl = config.session.ttl || '3d';
        if (typeof config.session.ttl == 'string') config.session.ttl = ms(config.session.ttl);
    }

    delete config.dev;
    if (config.port == '$env') config.port = process.env.PORT;

    // Hacky way to fix v14.17.5 warning:
    // (node:8604) Warning: Accessing non-existent property 'colorPallette' of module exports inside circular dependency
    if (!config.colorPallette) config.colorPallette = null;
    return config;
}

let configPath = Path.join(process.cwd(), 'config');
if (configArgIndex !== -1) {
    configPath = process.argv[configArgIndex + 1];
    if (!configPath.startsWith('/')) configPath = Path.join(process.cwd(), configPath);
}

delete require.cache[configPath];
module.exports = proceedConfig(require(configPath));
