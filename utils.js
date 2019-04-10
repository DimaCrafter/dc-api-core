const log = require('./log');
const session = require('./session');
const config = require('./config');
const getBase = (req) => {
    return {
        get db () { log.warn('`this.db` is deprecated, use require(\'dc-api-core/DB\') instead'); },
        query: req.query,
        ROOT: process.cwd()
    };
};

module.exports = {
    async getHTTP (req, res) {
        const ctx = getBase(req);
        ctx.data = req.body;
        ctx.send = (msg, code = 200, isPure = false) => {
            if (res.aborted) return;
            res.writeHeader('Access-Control-Allow-Origin', config.origin || req.headers.origin);
            res.writeHeader('Access-Control-Allow-Credentials', 'true');
            res.writeHeader('Access-Control-Allow-Headers', 'content-type');
            // TODO: make code - status object
            res.writeStatus(code.toString());
            
            if (isPure) res.end(msg);
            else res.end(JSON.stringify({
                success: code === 200,
                code,
                msg
            }));
        };

        try {
            ctx.session = await session(req, token => res.writeHeader('token', token));
        } catch (err) {
            ctx.err = err;
            return err;
        }

        return ctx;
    },

    async getWS (ws, req) {
        const ctx = getBase(req);
        ctx.send = (msg, code = 0) => {
            if (this._replyEvent) this.emit(this._replyEvent, msg, code);
            else log.warn('No event to reply');
        };
        ctx.emit = (event, msg, code = 0) => {
            ws.send(JSON.stringify({
                success: code === 0,
                code,
                msg,
                event
            }));
        };
        ctx.end = (msg = '', code = 1000) => ws.end(code, msg);

        try {
            ctx.session = await session(req, token => ctx.emit('token', token));
        } catch (err) {
            ctx.err = err;
            return err;
        }

        return ctx;
    }
};
