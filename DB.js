const core = require('.');
const config = require('./config');
const log = require('./log');
const Plugins = require('./plugins');

function connect (driverName, dbConfig, connectionName) {
    const driver = new Plugins.types.db[driverName](dbConfig);
    driver.on('connected', error => {
        if (error) {
            log.error(`Connection to ${connectionName} database was failed`, error);
            core.emitError({
                isSystem: true,
                type: 'DatabaseConnectionError',
                name: connectionName,
                error
            });
        } else {
            log.success(`Connected to ${connectionName} database`);
        }
    });

    const MODELS_BASE_PATH = process.cwd() + '/models/' + driverName;
    return new Proxy(driver, {
        get (driver, prop) {
            if (prop in driver) {
                return driver[prop];
            }

            // Here `prop` is model name
            try {
                return driver.getModel(MODELS_BASE_PATH, prop);
            } catch (err) {
                log.warn(`Database model ${prop} not found for ${dbConfig._name} configuration`);
            }
        }
    });
}

let connections = {};
module.exports = new Proxy(Plugins.types.db, {
    get (drivers, driverName) {
        if (driverName in drivers) {
            return (configKey, options) => {
                if (options && !options.identifier && !options.name) {
                    return log.warn('Templated connection to database must have `identifier` field');
                }

                // Key of configuration in config.db object
                configKey = driverName + (configKey ? ('.' + configKey) : '');

                // Unique name of current connection (equals configKey when not templated)
                const connectionName = options
                    ? (driverName + '.' + (options.identifier || options.name))
                    : configKey;

                // Reusing connections
                if (connectionName in connections) {
                    return connections[connectionName];
                }

                if (configKey in config.db) {
                    let dbConfig = config.db[configKey];
                    if (options) {
                        // Spread is used to make mutable copy without side-effects
                        dbConfig = { ...dbConfig, ...options };
                        delete dbConfig.identifier;
                    }

                    dbConfig._name = configKey;
                    connections[connectionName] = connect(driverName, dbConfig, connectionName);
                } else {
                    log.error(`Database configuration ${configKey} not found`);
                }
            };
        } else {
            return () => log.error(`Database driver ${driverName} not found`);
        }
    }
});
