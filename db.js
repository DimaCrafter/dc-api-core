const { emitError } = require('./errors');
const config = require('./config');
const log = require('./log');

function connect (connector, attempt = 0) {
    connector.connect().then(
        () => {
            log.success(`Connected to ${connector._name} database`);
            attempt = 0;
        },
        error => {
            log.error(`Connection to ${connector._name} database was failed`, error);
            emitError({
                isSystem: true,
                type: 'DatabaseConnectionError',
                name: connector._name,
                error
            });

            setTimeout(() => {
                log.info(`Reconnecting to ${connector._name}... Attempt #${attempt}`);
                connect(connector, attempt + 1);
            }, 5000);
        }
    );

    connector.on('disconnected', () => {
        log.error(`Disconnected from ${connector._name} database`);

        setTimeout(() => {
            log.info(`Reconnecting to ${connector._name}... Attempt #${attempt}`);
            connect(connector, attempt + 1);
        }, 5000);
    })
}

function maintainConnector (connector, dbConfig) {
    connect(connector);

    const MODELS_BASE_PATH = process.cwd() + '/models/' + dbConfig._name;
    return new Proxy(connector, {
        get (connector, /** @type {string} */ prop) {
            if (prop in connector) return connector[prop];

            // Here `prop` is model name
            try {
                return connector.getModel(MODELS_BASE_PATH, prop);
            } catch (err) {
                log.warn(`Database model "${prop}" not found for "${dbConfig._name}" configuration`);
            }
        }
    });
}

const connections = {};
const drivers = {};
exports.registerDriver = (DriverClass, driverName) => {
    DriverClass.connect = (configKey, options) => {
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

            const connector = new DriverClass(dbConfig);
            connector._self = DriverClass;
            connector._name = connectionName;
            return connections[connectionName] = maintainConnector(connector, dbConfig);
        } else {
            log.error(`Database configuration "${configKey}" not found`);
        }
    };

    drivers[driverName] = DriverClass;
    return DriverClass;
}

exports.connect = (configKey, options) => {
    const [driverName, connectionName] = configKey.split('.', 2);
    const DriverClass = drivers[driverName];

    if (DriverClass) return DriverClass.connect(connectionName, options);
    else log.error(`Database driver "${driverName}" not registered`);
}

const { EventEmitter } = require('events');
exports.DatabaseDriver = class DatabaseDriver extends EventEmitter {}
