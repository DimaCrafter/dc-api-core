const ROOT = process.cwd();
const core = require('.');
const log = require('./log');
const path = require('path');
const fs = require('fs');

const Router = require('./router');
const { ControllerWSContext, ControllerHTTPContext } = require('./context');

function getController (name) {
    if (!name) throw new core.HttpError('API controller not specified', 400);

    name = name[0].toUpperCase() + name.slice(1);
    return new Promise((resolve, reject) => {
        const controllerPath = path.normalize(`${ROOT}/controllers/${name}.js`);
        fs.access(controllerPath, fs.constants.F_OK | fs.constants.W_OK, err => {
            if (err) {
                if (err.code == 'ENOENT') reject([`API ${name} controller not found`, 404]);
                else reject([`Can't access ${name} controller`, 403]);
                return;
            }

            let controller = require(controllerPath);
            if (typeof controller != 'function') return reject([`Exported value from ${name} controller isn't a class`, 501]);
            controller = new controller();
            controller._name = name;
            resolve(controller);
        });
    });
}

async function load (controller, action, ctx, isOptional, args) {
    ctx.controller = controller = await getController(controller);

    try {
        if (controller.onLoad) {
            // Non-async result will be returned normally, async will be awaited
            const onLoadResult = await controller.onLoad.call(ctx);
            if (typeof onLoadResult != 'undefined') {
                log.warn('Returning value from onLoad deprecated, use this.drop() instead');
                return;
            }

            if (ctx._res.aborted) {
                return;
            }
        }
    } catch (err) {
        core.emitError({
            isSystem: false,
            controller: controller._name,
            action: 'onLoad',
            message: err.message,
            error: err
        });

        err._catched = true;
        throw err;
    }

    if (action in controller) {
        try {
            return await controller[action].apply(ctx, args);
        } catch (err) {
            core.emitError({
                isSystem: false,
                controller: controller._name,
                action,
                message: err.message,
                error: err
            });

            err._catched = true;
            throw err;
        }
    } else if (!isOptional) {
        throw new core.HttpError(`API ${controller.constructor.name}.${action} action not found`, 404);
    }
}

// TODO: better error reporting
function catchError (ctx, err) {
    if (err instanceof core.HttpError) {
        switch (ctx.type) {
            case 'http':
                ctx.send(err.message, err.code);
                break;
            case 'ws':
                ctx.emit('error', err.message, err.code);
                break;
        }

        core.emitError({
            isSystem: true,
            type: 'DispatchError',
            ...err,
            error: err
        });
    } else {
        switch (ctx.type) {
            case 'http':
                ctx.send(err.toString(), 500);
                break;
            case 'ws':
                ctx.emit('error', err.toString(), 500);
                break;
        }

        if (err._catched) return;
        core.emitError({
            isSystem: true,
            type: 'DispatchError',
            code: 500,
            message: err.message,
            error: err
        });
    }
}

const dispatch = {
    async http (req, res, handler) {
        const ctx = new ControllerHTTPContext(req, res);
        try {
            // TODO: check if session is required for this call through vanilla decorators
            await ctx.init();
        } catch (err) {
            return ctx.send(err.toString(), 500);
        }

        try {
            const result = await handler(ctx);
            if (!res.aborted && result !== undefined) {
                ctx.send(result);
            }
        } catch (err) {
            if (err instanceof core.HttpError) {
                ctx.send(err.message, err.code);
            } else {
                ctx.send(err.toString(), 500);
                return catchError(ctx, err);
            }
        }
    },

    WS_SYSTEM_EVENTS: ['open', 'close', 'error'],
    async ws (ws) {
        let obj = {};
        const controller = 'Socket';
        const ctx = new ControllerWSContext(ws);

        let initProgress;
        const init = async session => {
            try {
                await ctx.init(session);
            } catch (err) {
                return ctx.emit('error', err.toString(), 500);
            }

            try {
                await load(controller, 'open', ctx, true);
            } catch (err) {
                return catchError(ctx, err);
            }
        };

        obj.message = async msg => {
            const buf = Buffer.from(msg);
            const str = buf.toString();
            if (str.startsWith('session:')) {
                initProgress = init(str.slice(8));
                return;
            }

            if (initProgress) await initProgress;
            try {
                const parsed = JSON.parse(str);
                if (~parsed[0].indexOf(dispatch.WS_SYSTEM_EVENTS)) return;
                await load(controller, parsed[0], ctx, false, parsed.slice(1));
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
                try {
                    if (ctx) await load(controller, 'error', ctx, false, [code, msg]);
                } catch (err) {
                    log.error('Unhandled socket error', `WebSocket disconnected with code ${code}\nDriver message: ${msg}`);
                    core.emitError({
                        isSystem: true,
                        type: 'SocketUnhandledError',
                        code,
                        message: msg
                    });
                }
            }

            if (ctx) await load(controller, 'close', ctx, true);
        }

        return obj;
    }
};

module.exports = dispatch;
