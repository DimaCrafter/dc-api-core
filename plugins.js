const config = require('./config');
const ctx = {};
ctx.register = (type, val, ...args) => {
    switch (type) {
        case 'db':
            Plugins.types.db[args[0]] = val;
            break;
        default:
            throw `Type ${type} not found`;
    }
};

const Plugins = {
    types: {
        db: {}
    },

    ctx,
    init () {
        (config.plugins || []).forEach(plugin => require(plugin)(ctx));
    }
};

module.exports = Plugins;
