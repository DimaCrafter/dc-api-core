const core = require('.');
const config = require('./config');
const log = require('./log');
const Plugins = require('./plugins');

const exported = {
    ObjectIdFromTime (timestamp) {
        if (typeof timestamp == 'string') timestamp = new Date(timestamp).getTime();
        else if (timestamp instanceof Date) timestamp = timestamp.getTime();

        return (~~(timestamp / 1000)).toString(16) + '0000000000000000';
    }
};

let connections = {};
module.exports = new Proxy(Plugins.types.db, {
    get (drivers, driverName) {
        if (driverName in exported) return exported[driverName];

        if (driverName in drivers) {
            return (confName, options) => {
                if (options && !options.identifier && !options.name) return log.warn('Templated connection to database must have `identifier` field');
                confName = driverName + (confName ? ('.' + confName) : '');
                let connName = options ? (driverName + '.' + (options.identifier || options.name)) : confName;

                // Reusing connections
                if (connName in connections) return connections[connName].driverProxy;
                if (confName in config.db) {
                    let cfg = config.db[confName];
                    if (options) {
                        cfg = { ...cfg, ...options };
                        delete cfg.identifier;
                    }

                    const driver = new drivers[driverName](cfg, confName);
                    driver.cfg = cfg;
                    driver.on('connected', err => {
                        if (err) {
                            log.error(`Connection to database failed (${connName})`, err);
                            core.emitError({
                                isSystem: true,
                                type: 'DatabaseConnectionError',
                                name: connName,
                                error: err
                            });
                        } else {
                            log.success(`Connected to database (${connName})`);
                        }
                    });
                    driver.on('no-model', name => log.warn(`Database model ${confName}.${name} not found`));

                    const driverProxy = new Proxy(driver, {
                        get: (obj, prop) => (prop in obj) ? obj[prop] : obj.getModel(prop)
                    });
                    connections[connName] = { driver, driverProxy };
                    return driverProxy;
                } else {
                    log.error(`Database configuration ${confName} not found`);
                }
            };
        } else {
            return () => log.error(`Database driver ${driverName} not found`);
        }
    }
});
