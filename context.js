const log = require('./log');
const Session = require('./session');

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
        query: req.query,
        header (name, value) {
            name = name.toLowerCase();
            if (value !== undefined) {
                if (value == null) delete res.headers[name];
                else res.headers[name] = value;
            } else {
                return req.headers[name];
            }
        },
        address: getIP(req, res),

        get controller () { return controllerProxy; },
        set controller (controller) {
            controllerProxy = new Proxy(controller, {
                get (obj, prop) {
                    if (typeof obj[prop] === 'function') return obj[prop].bind(ctx);
                    return obj[prop];
                }
            });
        }
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
                if (!res.headers['content-type']) {
                    if (typeof data === 'string') res.writeHeader('Content-Type', 'text/plain');
                    else if (data instanceof Buffer) res.writeHeader('Content-Type', 'application/octet-stream');
                }
                res.end(data);
            } else {
                res.writeHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
            }
        };

        ctx.redirect = url => {
            if (res.aborted) return;
            res.writeStatus('302 Found');
            res.writeHeader('Location', url);
            res.end();
        };

        if (Session.enabled) {
            try {
                const session = await Session.parse(req.headers.session);
                if (session.header) res.headers.session = session.header;
                ctx.session = session.object;
            } catch (err) {
                ctx.err = err;
            }
        }

        return ctx;
    },

    async getWS (ws, sessionHeader) {
        // `req` and `res` in `getBase` used only to get
        // request/response values, that combined in `ws`
        const ctx = getBase(ws, ws);
        // emit(event, ...arguments);
        ctx.emit = (...args) => {
            if (ws.isClosed) return log.warn('Trying to send message via closed socket');
            ws.send(JSON.stringify(args));
        };
        ctx.end = (msg = '', code = 1000) => ws.end(code, msg);

        if (Session.enabled) {
            try {
                const session = await Session.parse(sessionHeader);
                if (session.header) ctx.emit('session', session.header);
                ctx.session = session.object;
            } catch (err) {
                ctx.err = err;
            }
        }

        return ctx;
    }
};
