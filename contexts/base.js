const { HttpError } = require('..');
const Session = require('../session');
const { parseIPv6Part } = require('../utils/parsers');

class ControllerBase {}

class ControllerBaseContext {
    constructor (req, res) {
        this._req = req;
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

    get session () {
        if (this._session) return this._session;
        else {
            if (Session.enabled) {
                this._session = Session.init();
                this._session._init.then(header => {
                    // @ts-ignore
                    switch (this.type) {
                        case 'http':
                            this._res.headers.session = JSON.stringify(header);
                            break;
                        case 'ws':
                            // @ts-ignore
                            this.emit('session', header);
                            break;
                    }
                });

                return this._session;
            } else {
                throw new HttpError('Trying to access session when it is disabled', 500);
            }
        }
    }
}

module.exports = {
	ControllerBase,
	ControllerBaseContext
};
