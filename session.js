const jwa = require('jwa')('HS256');
const config = require('./config');
const log = require('./log');
const { connectDatabase, makeModel, json, long } = require('./db');

const enabled = !!config.session;

/** @type {import('./db').Model<{ id: any, data: any, expires: number }>} */
let model;
if (enabled) {
    const db = connectDatabase(config.session.store);
    model = makeModel(db, 'Session', {
        data: json().required,
        expires: long().required
    });

    let _initPromise;
    if (model.init) _initPromise = model.init();

    async function cleanup () {
        await _initPromise;
        await model.delete({ expires: { $lte: Date.now() - config.session.ttl } });
    }

    cleanup();
    setInterval(() => cleanup, config.session.ttl / 3);
}

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

        return await model.updateById(document.id || document._id, { data });
    }

    document.destroy = async () => {
        await document._init;
        if (!document.id && !document._id) {
            return log.error('Cannot destroy session, `id` or `_id` field not present');
        }

        return await model.deleteById(document.id || document._id);
    };

    return document;
}

module.exports = {
    enabled,
    cryptSession,
    decodeSession,
    init () {
        const object = wrap({});
        object._init = model.create({
            data: {},
            expires: Date.now() + config.session.ttl
        }).then(document => {
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

        let query = model.findById(parsed.id);
        if (query.lean) query = query.lean();

        let session = await query;
        if (!session) return;

        const { data } = session;
        Object.assign(session, data);
        delete session.data;

        return wrap(session);
    }
};
