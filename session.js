const jwa = require('jwa')('HS256');
const config = require('./config');
const log = require('./log');
const { connectDatabase, makeModel, json, long } = require('./db');

const enabled = !!config.session;
const stores = {};

let store;

function cryptSession (id) {
    let result = { id, expires: Date.now() + config.session.ttl };
    result.sign = jwa.sign(result, config.session.secret);
    return result;
}

function decodeSession (input) {
    const { sign } = input;
    delete input.sign;

    if (!jwa.verify(input, sign, config.session.secret)) return;
    else if (input.expires <= Date.now()) return;
    else return input;
}

function wrap (document) {
    document.save = async () => {
        await document._init;
        if (!document.id && !document._id) {
            return log.error('Cannot save session, `id` or `_id` field not present');
        }

        const data = {};
        for (const key in document) {
            if (key == 'id' || key == '_id' || key == 'expires') continue;

            const value = document[key];
            if (typeof value == 'function') continue;

            data[key] = document[key];
        }

        return await store.update(document.id || document._id, data);
    }

    document.destroy = async () => {
        await document._init;
        if (!document.id && !document._id) {
            return log.error('Cannot destroy session, `id` or `_id` field not present');
        }

        return await store.delete(document.id || document._id);
    };

    return document;
}

module.exports = {
    enabled,
    cryptSession,
    decodeSession,
    init () {
        const object = wrap({});
        object._init = store
            .create(Date.now() + config.session.ttl)
            .then(document => {
                object.id = document.id;
                object._id = document._id;
                delete object._init;
                return cryptSession(document.id || document._id);
            });

        return object;
    },
    async parse (header) {
        if (!header) return;

        const parsed = decodeSession(header);
        if (!parsed) return;

        const session = await store.get(parsed.id);
        if (!session) return;

        const { data } = session;
        Object.assign(session, data);
        delete session.data;

        return wrap(session);
    },
    registerStore (StoreClass, id) {
        stores[id] = StoreClass;
    },
    // todo: rename init()
    initSessions () {
        if (enabled) {
            const [storeName, configKey] = config.session.store.split('.', 2);
            const StoreClass = stores[storeName];
            if (StoreClass) {
                store = new StoreClass(configKey);

                async function cleanup () {
                    await store.destroyExpired(Date.now() - config.session.ttl);
                }

                cleanup();
                setInterval(cleanup, config.session.ttl / 3);
            } else {
                // todo: delete deprecated
                log.warn('Using database instead of session store is deprecated');

                const db = connectDatabase(config.session.store);
                // todo: implement in dc-api-mysql
                const model = makeModel(db, 'Session', {
                    data: json().required,
                    expires: long().required
                });

                let _initPromise;
                if (model.init) _initPromise = model.init();

                store = {
                    create: expires => model.create({ data: {}, expires }),
                    get: _id => model.findById(_id),
                    save: (_id, data) => model.updateById(_id, { data }),
                    destroy: _id => model.deleteById(_id)
                };

                async function cleanup () {
                    await _initPromise;
                    await model.delete({ expires: { $lte: Date.now() - config.session.ttl } });
                }

                cleanup();
                setInterval(cleanup, config.session.ttl / 3);
            }
        }
    }
};
