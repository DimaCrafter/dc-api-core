const core = require('.');
const log = require('./log');
const Session = require('./session');

function parseIPv6Part (part) {
    let result = part.toString(16);
    if (result[1]) return result;
    else return '0' + result;
}

class ControllerBaseContext {
    constructor (req, res) {
        this._req = req;
        this._res = res;

        this.query = req.query;
    }

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

        this._address = result;
        return result;
    }

    // TODO: no context without controller
    get controller () {
        return this._controllerProxy;
    }
    set controller (controller) {
        this._controllerProxy = new Proxy(controller, {
            get (obj, prop) {
                if (typeof obj[prop] === 'function') return obj[prop].bind(ctx);
                return obj[prop];
            }
        });
    }
}

function getResponseStatus (code) {
    switch (code) {
        case 200: return '200 OK';
        case 201: return '201 Created';
        case 202: return '202 Accepted';
        case 203: return '203 Non-Authoritative Information';
        case 204: return '204 No Content';
        case 205: return '205 Reset Content';
        case 206: return '206 Partial Content';

        case 301: return '301 Moved Permanently';
        case 302: return '302 Found';
        case 303: return '303 See Other';
        case 304: return '304 Not Modified';
        case 307: return '307 Temporary Redirect';

        case 400: return '400 Bad Request';
        case 401: return '401 Unauthorized';
        case 403: return '403 Forbidden';
        case 404: return '404 Not Found';
        case 405: return '405 Method Not Allowed';
        case 406: return '406 Not Acceptable';
        case 408: return '408 Request Timeout';
        case 409: return '409 Conflict';
        case 410: return '410 Gone';
        case 415: return '415 Unsupported Media Type';

        case 500: return '500 Internal Server Error';
        case 501: return '501 Not Implemented';
        default: return code.toString();
    }
}

class ControllerHTTPContext extends ControllerBaseContext {
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

    send (data, code = 200, isPure = false) {
        if (this._res.aborted) return;
        this._res.aborted = true;

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
    }

    redirect (url) {
        if (this._res.aborted) return;
        this._res.aborted = true;

        this._res.writeStatus('302 Found');
        this._res.writeHeader('Location', url);
        this._res.end();
    }
}

class ControllerWSContext extends ControllerBaseContext {
    constructor (ws) {
        // `req` and `res` in `getBase` used only to get
        // request/response values, that combined in `ws`
        super(ws, ws);

        this.type = 'ws';
    }

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
    emit (...args) {
        if (this._req.isClosed) {
            return log.warn('Trying to send message via closed socket');
        }

        this._res.send(JSON.stringify(args));
    }

    end (msg = '', code = 1000) {
        this._res.end(code, msg);
    }
}

module.exports = {
    ControllerHTTPContext,
    ControllerWSContext
};
