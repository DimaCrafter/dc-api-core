const config = require('./config');
const base = (utils, db, req) => {
    return Object.assign(utils, {
        db,
        session: req.session,
        ROOT: process.cwd()
    });
};

module.exports = {
    getHTTPUtils(req, res, db) {
        return base({
            send(msg, code = 200) {
                res.set('Access-Control-Allow-Origin', config.origin || req.get('origin'));
                res.set('Access-Control-Allow-Credentials', 'true');
                res.set('Access-Control-Allow-Headers', '*');
                res.status(code);
                res.json({
                    success: code === 200,
                    code,
                    msg
                });
            },
            data: req.body
        }, db, req);
    },

    getWSUtils(ws, req, db) {
        return base({
            send(msg, code = 0) {
                ws.send(JSON.stringify({
                    success: code === 0,
                    code,
                    msg
                }));
            },
            end(...args) { this.send(...args); this.close(); },
            close() { ws.close(); },
            data: {}
        }, db, req);
    }
};
