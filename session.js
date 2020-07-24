const jwa = require('jwa')('HS256');
const { ObjectIdFromTime } = require('./DB');
const config = require('./config');

let db;
if (config.session) {
    const cfg = config.session.store.split('.');
    db = require('./DB')[cfg[0]](cfg[1]);

    const dbCfg = config.db[config.session.store];
    if (dbCfg.nonStrict) dbCfg.nonStrict.push('Session')
    else dbCfg.nonStrict = ['Session'];

    function cleanup () {
        db.Session.deleteMany({ _id: { $lte: ObjectIdFromTime(Date.now() - config.session.ttl) } });
    }

    cleanup();
    setInterval(() => cleanup, config.session.ttl / 2);
}

function cryptSession (_id) {
    let result = { _id, expires: Date.now() + config.session.ttl };
    result.sign = jwa.sign(result, config.session.secret);
    return JSON.stringify(result);
}

function decodeSession (input) {
    try {
        input = JSON.parse(input);
    } catch (err) {
        return;
    }
    
    const sign = input.sign;
    delete input.sign;

    if (!jwa.verify(input, sign, config.session.secret)) return;
    if (input.expires <= Date.now()) return;
    return input;
}

function wrap (document) {
    document.save = cb => {
        if (!document._id) return log.error('Can`t save session, _id field not present');
        const data = {};
        for (const key in document) {
            if (typeof key == 'function' || key == '_id') continue;
            data[key] = document[key];
        }

        return db.Session.updateOne({ _id: document._id }, data, cb);
    }

    document.destroy = cb => {
        if (!document._id) return log.error('Can`t destroy session, _id field not present');
        return db.Session.deleteOne({ _id: document._id }, cb);
    };

    return document;
}

module.exports = {
    enabled: !!config.session,
    async create () {
        const session = await db.Session.create({});
        return {
            header: cryptSession(session._id),
            object: wrap(session.toObject())
        };
    },
    async parse (header) {
        if (!header) return await this.create();
        
        const parsed = decodeSession(header);
        if (!parsed) return await this.create();
        
        let session = await db.Session.findById(parsed._id).lean();
        if (!session) return await this.create();

        return {
            object: wrap(session)
        };
    }
};
