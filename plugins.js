const Plugins = {
    db_drivers: {},

    utils: {
        register (type, val, ...args) {
            switch (type) {
                case 'db':
                    Plugins.db_drivers[args[0]] = val;
                    break;
                default:
                    throw 'Type ' + type + ' not founded';
            }
        }
    }
};

module.exports = Plugins;
