const { ControllerBase, ControllerBaseContext } = require('./base');
const { parseRequest } = require('../utils/http');
const { emitError, HttpError } = require('../errors');
const config = require('../config');
const log = require('../log');
const Session = require('../session');

class SocketController extends ControllerBase {}

let connected = [];
const channels = new Set();
/**
 * @extends {ControllerBaseContext<import('./websocket').Socket, import('./websocket').Socket>}
 */
class SocketControllerContext extends ControllerBaseContext {
    /**
     * @param {import('./websocket').Socket} ws
     */
    constructor (ws) {
		// `req` and `res` in `getBase` used only to get
        // request/response values, that combined in `ws`
        super(ws, ws);

        this.type = 'ws';
    }

    _destroy () {
        const i = connected.indexOf(this);
        if (~i) connected.splice(i, 1);
    }

    /**
     * @param {string} sessionHeader
     */
    async init (sessionHeader) {
        if (Session.enabled) {
            try {
                this._session = await Session.parse(sessionHeader);
            } catch (err) {
                emitError({
                    isSystem: true,
                    type: 'SessionError',
                    code: 500,
                    message: err.message,
                    error: err
                });

                throw err;
            }
        }

        connected.push(this);
    }

    // emit(event, ...arguments);
    emit (...args) {
        if (this._req.isClosed) {
            return log.warn('Trying to send message via closed socket');
        }

        this._res.send(JSON.stringify(args));
    }

    emitFirst (filter, ...args) {
        for (const ctx of connected) {
            if (filter(ctx)) {
                ctx._res.send(JSON.stringify(args));
                break;
            }
        }
    }

    subscribe (channel) { channels.add(channel); }
    unsubscribe (channel) {
        if (channel) channels.delete(channel);
        else channels.clear();
    }

    broadcast (channel, ...args) {
        const payload = JSON.stringify(args);
        if (channel) {
            for (const ctx of connected) {
                if (ctx._channels.has(channel)) ctx._req.send(payload);
            }
        } else {
            for (const ctx of connected) {
                ctx._req.send(payload);
            }
        }
    }

    end (msg = '', code = 1000) {
        if (!this._req.isClosed) {
            this._res.end(code, msg);
        }
    }
}

/**
 * @param {import('uWebSockets.js').TemplatedApp} app
 * @param {string} path
 * @param {import('./websocket').SocketController} controller
 */
function registerSocketController (app, path, controller) {
	app.ws(path, {
		maxPayloadLength: 16 * 1024 * 1024, // 16 Mb
		idleTimeout: config.ttl || 0,
		upgrade (res, req, context) {
			const ws = { isClosed: false };
			parseRequest(req, ws);

			res.upgrade(
				ws,
				ws.headers['sec-websocket-key'],
				ws.headers['sec-websocket-protocol'],
				ws.headers['sec-websocket-extensions'],
				context
			);
		},
		async open (ws) {
			try {
				ws.dispatch = dispatch(ws, controller);
			} catch (err) {
				log.error('WebSocket request dispatch error', err);
			}
		},
		message (ws, msg, isBinary) { ws.dispatch.message(msg, isBinary); },
		close (ws, code, msg) {
			ws.isClosed = true;
			ws.dispatch.error(code, msg);
		}
	});
}

function catchError (ctx, err) {
    if (err instanceof HttpError) {
        ctx.emit('error', err.message, err.code);

        emitError({
            isSystem: true,
            type: 'DispatchError',
            ...err,
            error: err
        });
    } else {
        ctx.emit('error', err.toString(), 500);

        emitError({
            isSystem: true,
            type: 'DispatchError',
            code: 500,
            message: err.message,
            error: err
        });
    }
}

const WS_SYSTEM_EVENTS = ['open', 'close', 'error'];
/**
 * @param {import('./websocket').SocketController} controller
 */
function dispatch (ws, controller) {
    let obj = {};
    const ctx = new SocketControllerContext(ws);

    let initProgress;
    const init = async session => {
        try {
            await ctx.init(session);
        } catch (err) {
            return ctx.emit('error', err.toString(), 500);
        }

        try {
            if (controller.open) await controller.open.call(ctx);
        } catch (err) {
            return catchError(ctx, err);
        }

        initProgress = undefined;
    };

    if (!Session.enabled) initProgress = init();

    obj.message = async msg => {
        if (initProgress) await initProgress;
        try {
            const parsed = JSON.parse(Buffer.from(msg).toString());
            if (parsed[0] == 'session') {
                initProgress = init(parsed[1]);
                return;
            } else {
                await initProgress;
            }

            if (~parsed[0].indexOf(WS_SYSTEM_EVENTS)) return;
            if (parsed[0] in controller) {
                controller[parsed[0]].apply(ctx, parsed.slice(1));
            }
        } catch (err) {
            return catchError(ctx, err);
        }
    }

    obj.error = async (code, msg) => {
        // 0 - Clear close
        // 1001 - Page closed
        // 1006 & !message - Browser ended connection with no close frame.
        //                   In most cases it means "normal" close when page reloaded or browser closed
        if (code != 0 && code != 1000 && code != 1001 && (code != 1006 || msg)) {
            msg = Buffer.from(msg).toString();
            if (ctx) {
                if (controller.error) {
                    await controller.error.call(ctx, [code, msg]);
                } else {
                    log.error('Unhandled socket error', `WebSocket disconnected with code ${code}\nDriver message: ${msg}`);
                    emitError({
                        isSystem: true,
                        type: 'SocketUnhandledError',
                        code,
                        message: msg
                    });
                }
            }
        }

        if (ctx) {
            if (controller.close) controller.close.call(ctx);
            // @ts-ignore
            ctx._destroy();
        }
    }

    return obj;
}

module.exports = {
	SocketController,
	SocketControllerContext,
	registerSocketController,
    dispatchSocket: dispatch
};
