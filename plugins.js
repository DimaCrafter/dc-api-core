const config = require('./config');
const log = require('./log');
const ctx = {
    db (driver, name) {
        Plugins.types.db[name] = driver;
    },
    register (type, ...args) {
        this[type](...args);
        log.warn(`core.register('${type}', ...) is deprecated, use core.${type}(...) instead`);
    }
};

const Plugins = {
    types: {
        db: {}
    },

    ctx,
    init () {
        if (!config.plugins) return;

        for (const pluginName of config.plugins) {
            const plugin = require(pluginName);
            if (plugin.install) {
                plugin.install(ctx);
            } else if (typeof plugin == 'function') {
                plugin(ctx);
            }
        }
    }
};

module.exports = Plugins;
