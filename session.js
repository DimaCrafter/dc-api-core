const jwa = require('jwa')('HS256');
const config = require('./config');
const log = require('./log');

let db;
if (config.session) {
    const dbConfigName = config.session.store.split('.');
    db = require('./DB')[dbConfigName[0]](dbConfigName[1]);

    const dbConfig = config.db[config.session.store];
    if (dbConfig.nonStrict) dbConfig.nonStrict.push('Session')
    else dbConfig.nonStrict = ['Session'];

    function cleanup () {
        db.Session.deleteMany({ _id: { $lte: db.ObjectIdFromTime(Date.now() - config.session.ttl) } });
    }

    cleanup();
    setInterval(() => cleanup, config.session.ttl / 2);
}

function cryptSession (_id) {
    let result = { _id, expires: Date.now() + config.session.ttl };
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
        if (!document._id) return log.error('Can`t save session, _id field not present');

        const data = {};
        for (const key in document) {
            if (typeof key == 'function' || key == '_id') continue;
            data[key] = document[key];
        }

        return await db.Session.replaceOne({ _id: document._id }, data);
    }

    document.destroy = async () => {
        await document._init;
        if (!document._id) return log.error('Can`t destroy session, _id field not present');

        return await db.Session.deleteOne({ _id: document._id });
    };

    return document;
}

module.exports = {
    enabled: !!config.session,
    init () {
        const object = wrap({});
        object._init = db.Session.create({}).then(document => {
            object._id = document._id;
            delete object._init;
            return cryptSession(document._id)
        });

        return object;
    },
    async parse (header) {
        if (!header) return;

        const parsed = decodeSession(header);
        if (!parsed) return;

        let session = await db.Session.findById(parsed._id).lean();
        if (!session) return;

        return wrap(session);
    }
};
