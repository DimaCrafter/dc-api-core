const Path = require('path');
const { emitError } = require('./errors');
const config = require('./config');
const log = require('./log');

async function connect (connector, attempt = 0) {
    try {
        await connector.connect();
        log.success(`Connected to ${connector._name} database`);
        attempt = 0;
    } catch (error) {
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
}

function makeModel (connector, modelName, schema) {
    for (const field in schema) {
        const descriptor = schema[field];
        if (descriptor instanceof ModelField) {
            schema[field] = descriptor.info;
        }
    }

    const model = connector.makeModel(modelName, schema);
    if (model.init) model.init();

    Object.defineProperty(connector, modelName, { value: model, writable: false });
    return model;
}

exports.makeModel = makeModel;

function maintainConnector (connector, dbConfig) {
    connect(connector);

    const MODELS_BASE_PATH = Path.join(process.cwd(), 'models', dbConfig._name);
    for (const entry of readdirSync(MODELS_BASE_PATH)) {
        if (!entry.endsWith('.js')) continue;

        const modelName = entry.slice(0, -3);
        const modelPath = Path.join(MODELS_BASE_PATH, entry);
        if (!existsSync(modelPath)) {
            log.warn(`Database model "${modelName}" not found for "${dbConfig._name}" configuration`);
            return;
        }

        try {
            // todo: schema types
            const schema = require(modelPath);
            if (connector.makeModel) {
                makeModel(connector, modelName, schema);
            } else {
                // todo! deprecate
                const model = connector.getModel(modelName, schema);
                Object.defineProperty(connector, modelName, { value: model, writable: false });
            }

        } catch (error) {
            log.error(`Cannot load "${modelName}" model for "${dbConfig._name}" configuration`, error);
            process.exit(-1);
        }
    }

    return connector;
}

const connections = {};
const drivers = {};
exports.registerDriver = (DriverClass, driverName) => {
    // todo: DRY
    for (const key in config.db) {
        if (key == driverName || key.startsWith(driverName + '.')) {
            const dbConfig = config.db[key];
            // todo! write docs
            if (dbConfig.template) continue;

            const connector = new DriverClass(dbConfig);
            connector._self = DriverClass;
            connector._name = key;
            dbConfig._name = key;
            connections[key] = maintainConnector(connector, dbConfig);
        }
    }

    DriverClass.connect = (configKey, options) => {
        if (options && !options.identifier && !options.name) {
            return log.warn('Templated database connection must have `identifier` field');
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

exports.connectDatabase = (configKey, options) => {
    const [driverName, connectionName] = configKey.split('.', 2);
    const DriverClass = drivers[driverName];

    if (DriverClass) return DriverClass.connect(connectionName, options);
    else log.error(`Database driver "${driverName}" not registered`);
}

const { EventEmitter } = require('events');
const { existsSync, readdirSync } = require('fs');
exports.DatabaseDriver = class DatabaseDriver extends EventEmitter {}

class ModelField {
    info = {};
    constructor (type) {
        this.info.type = type;
        this.info.required = false;
    }

    get required () {
        this.info.required = true;
        return this;
    }

	default (value) {
        this.info.default = value;
        return this;
    }
}

class ModelInt extends ModelField {
    constructor () { super('int'); }
}
exports.int = () => new ModelInt();

class ModelLong extends ModelField {
    constructor () { super('long'); }
}
exports.long = () => new ModelLong();

class ModelString extends ModelField {
    constructor (length) {
        super('string');
        this.info.length = length;
    }
}
exports.string = length => new ModelString(length);

class ModelText extends ModelField {
    constructor () { super('text'); }
}
exports.text = () => new ModelText();

class ModelJson extends ModelField {
    constructor () { super('json'); }
}
exports.json = () => new ModelJson();

class ModelEnum extends ModelField {
    constructor (values) {
        super('enum');
        this.info.values = values;
    }
}
exports.enumerable = (...values) => new ModelEnum(values);
