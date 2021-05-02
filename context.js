const core = require('.');
const log = require('./log');
const Session = require('./session');
const { getResponseStatus } = require('./utils/http');

/**
 * @param {number} part
 */
function parseIPv6Part (part) {
    let result = part.toString(16);
    if (result[1]) return result;
    else return '0' + result;
}

class ControllerBaseContext {
    /**
     * @param {import("uWebSockets.js").HttpRequest} req
     * @param {import("uWebSockets.js").HttpResponse} res
     */
    constructor (req, res) {
        /**
         * @type {import('uWebSockets.js').HttpRequest}
         * @private
         */
        this._req = req;
        /**
         * @type {import('uWebSockets.js').HttpResponse}
         * @private
         */
        this._res = res;

        this.query = req.query;
    }

    /**
     * @param {string} name
     * @param {any} value
     */
    header (name, value) {
        name = name.toLowerCase();
        if (value === undefined) {
            return this._req.headers[name];
        } else {
            if (value == null) delete this._res.headers[name];
            else this._res.headers[name] = value;
        }
    }

    get address () {
        if (this._address) return this._address;
        const buf = Buffer.from(this._res.getRemoteAddress());

        let value = '';
        let isV4 = true;

        let last = [];
        for (let i = 0; i < buf.length; i++) {
            const current = buf[i];
            if (i < 10) {
                if (current != 0) {
                    isV4 = false;
                }
            } else if (i < 12) {
                if (current != 0xFF) {
                    isV4 = false;
                }
            } else if (isV4) {
                if (i == 12) value = current.toString();
                else value += '.' + current;
            }

            if (i < 12 || !isV4) {
                last.push(current);
                if (i % 2 != 0) {
                    if (last[0] == 0 && last[1] == 0) {
                    } else {
                        value += parseIPv6Part(last[0]);
                        value += parseIPv6Part(last[1]);
                    }

                    if (i != 15) value += ':';
                    last = [];
                }
            }
        }

        const isProxied = isV4
            // Loopback, docker and local subnets
            ? (value.startsWith('127.') || value.startsWith('172.18.') || value.startsWith('192.168.') || value.startsWith('10.'))
            // Loopback and Unique Local Address
            : value == ':::::::0001' || value.startsWith('fd');

        let result;
        if (isProxied) {
            const realValue = this._req.headers['x-real-ip'];
            if (realValue) {
                result = {
                    type: ~realValue.indexOf('.') ? 'ipv4' : 'ipv6',
                    value: realValue
                };
            }
        }

        if (!result) {
            result = {
                type: isV4 ? 'ipv4' : 'ipv6',
                value
            };
        }

        /** @private */
        this._address = result;
        return result;
    }

    // TODO: no context without controller
    get controller () {
        return this._controllerProxy;
    }
    set controller (controller) {
        /** @private */
        this._controllerProxy = {};
        const { prototype } = controller.constructor;
        for (const key of Object.getOwnPropertyNames(prototype)) {
            if (key == 'constructor') continue;

            const prop = prototype[key];
            if (typeof prop == 'function') {
                this._controllerProxy[key] = prop.bind(this);
            } else {
                this._controllerProxy[key] = controller[key] || prop;
            }
        }
    }
}

class ControllerHTTPContext extends ControllerBaseContext {
    /**
     * @param {{ body: any; }} req
     * @param {any} res
     */
    constructor (req, res) {
        super(req, res);

        this.type = 'http';
        this.data = req.body;
    }

    async init () {
        // TODO: disable session for dummy requests
        if (Session.enabled) {
            try {
                const session = await Session.parse(this._req.headers.session);
                if (session.header) {
                    this._res.headers.session = session.header;
                }

                this.session = session.object;
            } catch (err) {
                core.emitError({
                    isSystem: true,
                    type: 'SessionError',
                    code: 500,
                    message: err.message,
                    error: err
                });

                throw err;
            }
        }
    }

    /**
     * @param {any} data Data to send
     * @param {number} code HTTP response code, by default `200`
     * @param {boolean} isPure Data will be sended without any transformations when `true`, by default `false`
     */
    send (data, code = 200, isPure = false) {
        if (this._res.aborted) return;
        this._res.aborted = true;

        this._res.cork(() => {
            this._res.writeStatus(getResponseStatus(code));
            for (const header in this._res.headers) {
                this._res.writeHeader(header, this._res.headers[header]);
            }

            if (isPure) {
                if (!this._res.headers['content-type']) {
                    if (typeof data === 'string') {
                        this._res.writeHeader('Content-Type', 'text/plain');
                    } else if (data instanceof Buffer) {
                        this._res.writeHeader('Content-Type', 'application/octet-stream');
                    }
                }

                this._res.end(data);
            } else {
                this._res.writeHeader('Content-Type', 'application/json');
                this._res.end(JSON.stringify(data));
            }
        });
    }

    drop () {
        if (this._res.aborted) return;
        this._res.aborted = true;
        // Just ignoring request
        // TODO: check efficiency
    }

    /**
     * @param {import("uWebSockets.js").RecognizedString} url
     */
    redirect (url) {
        if (this._res.aborted) return;
        this._res.aborted = true;

        this._res.writeStatus('302 Found');
        this._res.writeHeader('Location', url);
        this._res.end();
    }
}

class ControllerWSContext extends ControllerBaseContext {
    /**
     * @param {any} ws
     */
    constructor (ws) {
        // `req` and `res` in `getBase` used only to get
        // request/response values, that combined in `ws`
        super(ws, ws);

        this.type = 'ws';
    }

    /**
     * @param {any} sessionHeader
     */
    async init (sessionHeader) {
        if (Session.enabled) {
            try {
                const session = await Session.parse(sessionHeader);
                if (session.header) {
                    this.emit('session', session.header);
                }

                this.session = session.object;
            } catch (err) {
                core.emitError({
                    isSystem: true,
                    type: 'SessionError',
                    code: 500,
                    message: err.message,
                    error: err
                });

                throw err;
            }
        }
    }

    // emit(event, ...arguments);
    /**
     * @param {(string | number)[]} args
     */
    emit (...args) {
        if (this._req.isClosed) {
            return log.warn('Trying to send message via closed socket');
        }

        this._res.send(JSON.stringify(args));
    }

    end (msg = '', code = 1000) {
        if (!this._req.isClosed) {
            this._res.end(code, msg);
        }
    }
}

module.exports = {
    ControllerHTTPContext,
    ControllerWSContext
};
