const jwt = require('jsonwebtoken');
const config = require('./config');

let db;
if (config.session) {
    let cfg = config.session.store.split('.');
    db = require('./DB')[cfg[0]](cfg[1]);
    const dbCfg = config.db[config.session.store];
    dbCfg.nonStrict ? dbCfg.nonStrict.push('Session') : (dbCfg.nonStrict = ['Session']);
}

function parse (document) {
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


function create (onToken, resolve, reject) {
    db.Session.create({}, (err, session) => {
        if (err) return reject('Can`t create session');
        jwt.sign({ _id: session._id }, config.session.secret, {
            expiresIn: config.session.ttl
        }, (err, token) => {
            if (err) return reject('Can`t sign session');
            session.token = token;
            session.save();
            onToken(token);
            resolve(parse(session.toObject()));
        });
    });
}

module.exports = (token, onToken) => {
    return new Promise((resolve, reject) => {
        if (token) {
            jwt.verify(token, config.session.secret, (err, data) => {
                if (err) return create();
                db.Session.findById(data._id).lean().exec((err, session) => {
                    if (err) return reject('Can`t get session');
                    if (!session) create(onToken, resolve, reject);
                    else resolve(parse(session));
                });
            });
        } else {
            create(onToken, resolve, reject);
        }
    });
};

module.exports.enabled = !!config.session;
