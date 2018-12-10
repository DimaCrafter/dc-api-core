const config = require('./config');
const db = require('./DB');
const base = (utils, req) => {
    return Object.assign(utils, {
        db,
        session: req.session,
        ROOT: process.cwd()
    });
};

module.exports = {
    getHTTPUtils(req, res) {
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
        }, req);
    },

    getWSUtils(ws, req) {
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
        }, req);
    }
};
