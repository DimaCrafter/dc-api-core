const { ControllerBase } = require('./base');
const { camelToKebab } = require('../utils');
const log = require('../log');
const config = require('../config');

// Shared NATS connection, set when registerNatsConnection is called
let _nc = null;

function registerNatsConnection (nc) {
    _nc = nc;
}

class NatsController extends ControllerBase {}
class NatsSubscription extends ControllerBase {}

class NatsControllerContext {
    constructor (msg) {
        this._msg = msg;
        this.subject = msg.subject;
        const raw = Buffer.from(msg.data).toString();
        this.data = raw ? JSON.parse(raw) : null;
    }

    get controller () {
        return this._controllerProxy;
    }

    set controller (controller) {
        this._controllerProxy = {};
        const { prototype } = controller.constructor;

        for (const key of Object.getOwnPropertyNames(prototype)) {
            if (key === 'constructor') continue;

            const prop = prototype[key];

            if (typeof prop === 'function') {
                this._controllerProxy[key] = prop.bind(this);
            } else {
                this._controllerProxy[key] = controller[key] || prop;
            }
        }
    }
}

class NatsSubscriptionContext {
    constructor (msg) {
        this._msg = msg;
        this.subject = msg.subject;
        const raw = Buffer.from(msg.data).toString();
        this.data = raw ? JSON.parse(raw) : null;
    }

    publish (subject, data) {
        _nc.publish(subject, Buffer.from(JSON.stringify(data)));
    }

    get controller () {
        return this._controllerProxy;
    }
    set controller (controller) {
        this._controllerProxy = {};
        const { prototype } = controller.constructor;
        for (const key of Object.getOwnPropertyNames(prototype)) {
            if (key === 'constructor') continue;

            const prop = prototype[key];
            if (typeof prop === 'function') {
                this._controllerProxy[key] = prop.bind(this);
            } else {
                this._controllerProxy[key] = controller[key] || prop;
            }
        }
    }
}

async function registerNatsSubscription (nc, prefix, controllerName, controller) {
    const base = prefix ? `${prefix}.${controllerName}` : controllerName;

    for (const action of Object.getOwnPropertyNames(controller.constructor.prototype)) {
        if (action[0] === '_' || action === 'onLoad' || action === 'constructor') continue;

        const subject = `${base}.${camelToKebab(action)}`;
        const sub = nc.subscribe(subject);

        if (config.isDev) log.info(`NATS  ${'SUB'.padEnd(9)} ${subject}`);

        (async () => {
            for await (const msg of sub) {
                try {
                    const ctx = new NatsSubscriptionContext(msg);
                    if (controller.onLoad) await controller.onLoad.call(ctx);
                    ctx.controller = controller;
                    await controller[action].call(ctx);
                } catch (error) {
                    if (config.isDev) log.error(`NATS SUB [${subject}]`, error);
                }
            }
        })();
    }
}

async function registerNatsController (nc, prefix, controllerName, controller) {
    const base = prefix ? `${prefix}.${controllerName}` : controllerName;

    for (const action of Object.getOwnPropertyNames(controller.constructor.prototype)) {
        if (action[0] === '_' || action === 'onLoad' || action === 'constructor') continue;

        const subject = `${base}.${camelToKebab(action)}`;
        const sub = nc.subscribe(subject, { queue: subject });

        if (config.isDev) log.info(`NATS  ${'REQ'.padEnd(9)} ${subject}`);

        (async () => {
            for await (const msg of sub) {
                try {
                    const ctx = new NatsControllerContext(msg);
                    if (controller.onLoad) await controller.onLoad.call(ctx);
                    ctx.controller = controller;
                    const result = await controller[action].call(ctx);
                    if (result !== undefined && msg.reply) {
                        msg.respond(Buffer.from(JSON.stringify(result)));
                    }
                } catch (error) {
                    if (msg.reply) {
                        msg.respond(Buffer.from(JSON.stringify({ error: error.message, code: 500 })));
                    }
                    if (config.isDev) log.error(`NATS REQ [${subject}]`, error);
                }
            }
        })();
    }
}

module.exports = { NatsController, NatsSubscription, registerNatsConnection, registerNatsController, registerNatsSubscription };
