const config = require('./config');
const Plugins = require('./plugins');

let connections = {};
module.exports = new Proxy(Plugins.db_drivers, {
    get (drivers, driverName) {
        // Return primitive values
        if (driverName in {}) return ({})[driverName];
        if (driverName in drivers) {
            return cfg => {
                cfg = driverName + (cfg ? ('.' + cfg) : '');
                // Reusing connections
                if (cfg in connections) return connections[cfg].driverProxy;
                if (cfg in config.db) {
                    const driver = new drivers[driverName](config.db[cfg], cfg);
                    driver.on('connected', err => {
                        if (err) console.log(`[DB] Connection failed (${cfg})\n${err}`);
                        else console.log(`[DB] Connected (${cfg})`);
                    });
                    driver.on('no-model', name => console.log(`[DB] Model ${cfg}.${name} not found`));

                    const driverProxy = new Proxy(driver, {
                        get(obj, prop) {
                            if (typeof prop === 'symbol') return;
                            if (prop.startsWith('__') && (prop = prop.replace(/^__/, '')) in obj) {
                                return obj[prop];
                            } else {
                                return obj.getModel(prop);
                            }
                        }
                    });
                    connections[cfg] = { driver, driverProxy };
                    return driverProxy;
                } else {
                    console.log(`[DB] Configuration ${cfg} not found`);
                }
            };
        } else {
            return () => console.log(`[DB] Driver ${driverName} not found`);
        }
    }
});
