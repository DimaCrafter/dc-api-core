const log = require('./log');
const session = require('./session');

function getIP (req, res) {
    // Parsing
    let ipRaw = Buffer.from(res.getRemoteAddress()).toString('hex');

    // Using X-Real-IP in docker container (172.18.XXX.XXX -> AC12XXXX) or on localhost
    if ((ipRaw.slice(24, 28) == 'ac12' || ipRaw == '00000000000000000000000000000001' || ipRaw == '00000000000000000000ffff7f000001') && req.headers['x-real-ip']) {
        ipRaw = req.headers['x-real-ip'];
        return {
            type: ~ipRaw.indexOf('.') ? 'ipv4' : 'ipv6',
            value: ipRaw
        };
    }

    // Formatting
    const ipParts = [];
    for (let i = 0; i < ipRaw.length; i += 4) ipParts.push(ipRaw.slice(i, i + 4));
    if (ipParts[ipParts.length - 3] == 'ffff') {
        const ipv4 = [];
        ipv4.push(parseInt(ipParts[ipParts.length - 2].slice(0, 2), 16));
        ipv4.push(parseInt(ipParts[ipParts.length - 2].slice(2), 16));
        ipv4.push(parseInt(ipParts[ipParts.length - 1].slice(0, 2), 16));
        ipv4.push(parseInt(ipParts[ipParts.length - 1].slice(2), 16));
        return {
            type: 'ipv4',
            value: ipv4.join('.')
        };
    } else {
        return {
            type: 'ipv6',
            value: ipParts.join(':')
        };
    }
}

function getBase (req, res) {
    let controllerProxy;
    const ctx = {
        get db () { log.warn('`this.db` is deprecated, use require(\'dc-api-core/DB\') instead'); },
        query: req.query,
        ROOT: process.cwd(),
        redirect (url) {
            res.writeStatus('302 Found');
            res.writeHeader('Location', url);
            res.end();
        },
        address: getIP(req, res),

        set controller (controller) {
            controllerProxy = new Proxy(controller, {
                get (obj, prop) {
                    if (typeof obj[prop] === 'function') return obj[prop].bind(ctx);
                    return obj[prop];
                }
            });
        },
        get controller () { return controllerProxy; }
    };

    return ctx;
}

module.exports = {
    async getHTTP (req, res) {
        const ctx = getBase(req, res);
        ctx.data = req.body;
        ctx.send = (data, code = 200, isPure = false) => {
            if (res.aborted) return;
            res.aborted = true;
            // TODO: make code - status object
            res.writeStatus(code.toString());
            for (const header in res.headers) res.writeHeader(header, res.headers[header]);
            
            if (isPure) {
                if (typeof data === 'string') res.writeHeader('Content-Type', 'text/plain');
                else if (data instanceof Buffer) res.writeHeader('Content-Type', 'application/octet-stream');
                res.end(data);
            } else {
                res.writeHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
            }
        };

        if (session.enabled) {
            try { ctx.session = await session(req.headers.token, token => res.headers.token = token); }
            catch (err) { ctx.err = err; }
        }

        return ctx;
    },

    async getWS (ws, req, token) {
        const ctx = getBase(req, ws);
        // emit(event, ...arguments);
        ctx.emit = (...args) => {
            if (ws.isClosed) return log.warn('Trying to send message via closed socket');
            ws.send(JSON.stringify(args));
        };
        ctx.end = (msg = '', code = 1000) => ws.end(code, msg);

        if (session.enabled) {
            try { ctx.session = await session(token, token => ctx.emit('token', token)); }
            catch (err) { ctx.err = err; }
        }

        return ctx;
    }
};
