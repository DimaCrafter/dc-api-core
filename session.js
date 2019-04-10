const jwt = require('jsonwebtoken');
const config = require('./config');

module.exports = (req, onToken) => {
    let db;
    if (config.session) {
        let cfg = config.session.store.split('.');
        db = require('./DB')[cfg[0]](cfg[1]);
        const dbCfg = config.db[config.session.store];
        dbCfg.nonStrict ? dbCfg.nonStrict.push('Session') : (dbCfg.nonStrict = ['Session']);
    }

    return new Promise((resolve, reject) => {
        if (req.headers.token) {
            jwt.verify(req.headers.token, config.session.secret, (err, _id) => {
                if (err) return reject('Incorrect session token: ' + err);
                db.Session.findOne({ _id }, (err, session) => {
                    if (err) return reject('Can`t get session');
                    resolve(session);
                });
            });
        } else {
            db.Session.create({}, (err, session) => {
                if (err) return reject('Can`t create session');
                jwt.sign(session._id, config.session.secret, (err, token) => {
                    if (err) return reject('Can`t sign session');
                    onToken(token);
                    resolve(session);
                });
            });
        }
    });
}
