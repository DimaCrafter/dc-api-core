const log = require('./log');
const session = require('./session');
const getBase = (req, res) => {
    // Parsing IP
    const ipRaw = Buffer.from(res.getRemoteAddress()).toString('hex');
    const ipParts = [];
    for (let i = 0; i < ipRaw.length; i += 4) ipParts.push(ipRaw.slice(i, i + 4));

    let address;
    if (ipParts[ipParts.length - 3] == 'ffff') {
        const ipv4 = [];
        ipv4.push(parseInt(ipParts[ipParts.length - 2].slice(0, 2), 16));
        ipv4.push(parseInt(ipParts[ipParts.length - 2].slice(2), 16));
        ipv4.push(parseInt(ipParts[ipParts.length - 1].slice(0, 2), 16));
        ipv4.push(parseInt(ipParts[ipParts.length - 1].slice(2), 16));
        address = {
            type: 'ipv4',
            value: ipv4.join('.')
        };
    } else {
        address = {
            type: 'ipv6',
            value: ipParts.join(':')
        };
    }

    return {
        get db () { log.warn('`this.db` is deprecated, use require(\'dc-api-core/DB\') instead'); },
        query: req.query,
        ROOT: process.cwd(),
        address
    };
};

module.exports = {
    async getHTTP (req, res) {
        const ctx = getBase(req, res);
        ctx.data = req.body;
        ctx.send = (msg, code = 200, isPure = false) => {
            if (res.aborted) return;
            res.aborted = true;
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
            ctx.session = await session(req.headers.token, token => res.writeHeader('token', token));
        } catch (err) {
            ctx.err = err;
        }

        return ctx;
    },

    async getWS (ws, req, token) {
        const ctx = getBase(req, ws);
        ctx.emit = (event, msg, code = 0) => {
            if (ws.isClosed) return log.warn('Trying to send message via closed socket');
            ws.send(JSON.stringify({
                success: code === 0,
                code,
                msg,
                event
            }));
        };
        ctx.send = (msg, code = 0) => {
            if (this._replyEvent) this.emit(this._replyEvent, msg, code);
            else log.warn('No event to reply');
        };
        ctx.end = (msg = '', code = 1000) => ws.end(code, msg);

        try {
            ctx.session = await session(token, token => ctx.emit('token', token));
        } catch (err) {
            ctx.err = err;
        }

        return ctx;
    }
};
