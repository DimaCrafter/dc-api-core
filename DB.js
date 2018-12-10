const config = require('./config');
const Plugins = require('./plugins');

module.exports = new Proxy(Plugins.db_drivers, {
    get (drivers, driverName) {
        // Return primitive values
        if (driverName in {}) return ({})[driverName];
        if (driverName in drivers) {
            return cfg => {
                cfg = driverName + (cfg ? ('.' + cfg) : '');
                if (cfg in config.db) {
                    const driver = new drivers[driverName](config.db[cfg]);
                    return new Proxy(driver, {
                        get(obj, prop) {
                            if (typeof prop === 'symbol') return;
                            if (prop.startsWith('__') && (prop = prop.replace(/^__/, '')) in obj) {
                                return obj[prop];
                            } else {
                                return obj.getModel(prop);
                            }
                        }
                    });
                } else {
                    console.log('Database configuration `' + cfg + '` not found');
                }
            };
        } else {
            return () => console.log('Database driver `' + driverName + '` not found');
        }
    }
});
