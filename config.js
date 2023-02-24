const Path = require('path');
const ms = require('ms');
const { existsSync } = require('fs');
const { mergeObj, getArg, getFlag } = require('./utils');
const log = require('./log');

const ROOT = process.cwd();
function load (path) {
    try {
        return require(path);
    } catch (error) {
        log.error('Config loading error', error);
        process.exit(-1);
    }
}

let config;
let configPath = getArg('--cfg');
if (configPath) {
    if (configPath[0] != '/') configPath = Path.join(ROOT, configPath);

    if (!existsSync(configPath)) {
        log.error('Config file not found');
        process.exit(-1);
    }

    config = load(configPath);
} else {
    configPath = require.resolve(Path.join(ROOT, 'config'));
    config = existsSync(configPath) ? load(configPath) : {};
}

if (config.port) {
    if (config.port == '$env') config.port = process.env.PORT;
} else {
    config.port = 8081;
}

config.db = config.db || {};
config.isDev = getFlag('--dev');

if (config.isDev) {
    if (config.dev) {
        mergeObj(config, config.dev);
    }

    config.ignore = config.ignore || [];
    if (!~config.ignore.indexOf('node_modules')) config.ignore.push('node_modules');
}

delete config.dev;

if (config.session) {
    config.session.ttl = config.session.ttl || '3d';
    if (typeof config.session.ttl == 'string') config.session.ttl = ms(config.session.ttl);
}

module.exports = config;
