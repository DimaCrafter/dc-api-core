/* // TODO: add this
function ObjectIdFromTime (timestamp) {
    if (typeof timestamp == 'string') timestamp = new Date(timestamp).getTime();
    var hexSeconds = Math.floor(timestamp / 1000).toString(16);
    return hexSeconds + '0000000000000000';
}
*/
const config = require('./config');
const log = require('./log');
const Plugins = require('./plugins');

let connections = {};
module.exports = new Proxy(Plugins.types.db, {
    get (drivers, driverName) {
        // Return primitive values
        if (driverName in {}) return ({})[driverName];
        if (driverName in drivers) {
            return (cfg, options) => {
                if (options) {
                    if (!options.identifier) return log.warn('Templated connection to database must have `identifier` field');
                    cfg = options.identifier;
                } else {
                    cfg = driverName + (cfg ? ('.' + cfg) : '');
                }
                // Reusing connections
                if (cfg in connections) return connections[cfg].driverProxy;
                if (options || cfg in config.db) {
                    const driver = new drivers[driverName](options || config.db[cfg], cfg);
                    driver.on('connected', err => {
                        if (err) log.error(`Connection to database failed (${cfg})`, err);
                        else log.success(`Connected to database (${cfg})`);
                    });
                    driver.on('no-model', name => log.warn(`Database model ${cfg}.${name} not found`));

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
                    log.error(`Database configuration ${cfg} not found`);
                }
            };
        } else {
            return () => log.error(`Database driver ${driverName} not found`);
        }
    }
});
