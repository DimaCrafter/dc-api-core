const ROOT = process.cwd();
const core = require('.');
const log = require('./log');
const path = require('path');
const fs = require('fs');
const { ControllerWSContext, ControllerHTTPContext } = require('./context');

function getController (name) {
    if (!name) throw [`API controller not specified`, 400];

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
        if (controller.onLoad && controller.onLoad.apply(ctx)) return;
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
            return controller[action].apply(ctx, args);
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
        throw [`API ${controller.constructor.name}.${action} action not found`, 404];
    }
}

function catchError (ctx, err) {
    if (err instanceof Array) {
        switch (ctx.type) {
            case 'http':
                ctx.send(...err);
                break;
            case 'ws':
                ctx.emit('error', ...err);
                break;
        }

        core.emitError({
            isSystem: true,
            type: 'DispatchError',
            code: err[1],
            message: err[0]
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
    async http (req, res) {
        const target = req._matchedRoute
            // Using target predefined for this route
            ? req._matchedRoute.target
            // Getting controller and action from path
            : req.path.split('/').slice(1);

        const ctx = new ControllerHTTPContext(req, res);
        try {
            await ctx.init();
        } catch (err) {
            return ctx.send(err.toString(), 500);
        }

        if (req._matchedRoute) {
            ctx.params = req._matchedRoute.params;
            delete req._matchedRoute;
        }

        try {
            switch (typeof target) {
                case 'function':
                    //+todo: fix session undefined config prop
                    target.call(ctx);
                default:
                    await load(target[0], target[1], ctx);
                    break;
            }
        } catch (err) {
            return catchError(ctx, err);
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
            if (code != 0 && code != 1000 && code != 1001) {
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
