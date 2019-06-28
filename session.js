const jwt = require('jsonwebtoken');
const config = require('./config');

module.exports = (token, onToken) => {
    let db;
    if (config.session) {
        let cfg = config.session.store.split('.');
        db = require('./DB')[cfg[0]](cfg[1]);
        const dbCfg = config.db[config.session.store];
        dbCfg.nonStrict ? dbCfg.nonStrict.push('Session') : (dbCfg.nonStrict = ['Session']);
    }

    function proxify (doc) {
        return new Proxy(doc, {
            get (obj, prop) {
                if (prop == 'destroy') {
                    return cb => db.Session.remove({ _id: obj._id }, cb);
                } else if (prop in obj) {
                    return obj[prop];
                } else {
                    return obj.get(prop);
                }
            },
            set (obj, prop, val) { return obj.set(prop, val); }
        });
    }

    return new Promise((resolve, reject) => {
        function create () {
            db.Session.create({}, (err, session) => {
                if (err) return reject('Can`t create session');
                jwt.sign({ _id: session._id }, config.session.secret, {
                    expiresIn: config.session.ttl
                }, (err, token) => {
                    if (err) return reject('Can`t sign session');
                    onToken(token);
                    resolve(proxify(session));
                });
            });
        }

        if (token) {
            jwt.verify(token, config.session.secret, (err, data) => {
                if (err) return reject('Incorrect session token: ' + err);
                db.Session.findOne({ _id: data._id }, (err, session) => {
                    if (err) return reject('Can`t get session');
                    if (!session) create();
                    else resolve(proxify(session));
                });
            });
        } else create();
    });
}
