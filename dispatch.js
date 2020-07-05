const ROOT = process.cwd();
const utils = require('./utils');
const log = require('./log');
const path = require('path');
const fs = require('fs');

async function getController (name) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
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
            resolve(controller);
        });
    });
}

async function load (controller, action, ctx, isOptional = false) {
    try { controller = await getController(controller); }
    catch (err) { throw err; }

    ctx.controller = controller;
    if (controller.onLoad && controller.onLoad.apply(ctx)) return;
    if (action in controller) return controller[action].apply(ctx, ctx._args);
    else if (!isOptional) throw [`API ${controller.constructor.name}.${action} action not found`, 404];
}

const dispatch = {
    async http (req, res) {
        const target = req._matchedRoute
            // Using target predefined for this route
            ? req._matchedRoute.target
            // Getting controller and action from path
            : req.path.split('/').slice(1);

        const ctx = await utils.getHTTP(req, res);
        if (ctx.err) return ctx.send(ctx.err, 500);

        if (req._matchedRoute) {
            ctx.params = req._matchedRoute.params;
            delete req._matchedRoute;
        }

        try {
            await load(target[0], target[1], ctx);
        } catch (err) {
            if (err instanceof Array) { ctx.send(...err); }
            else { ctx.send(err.toString(), 500); }
            return;
        }
    },

    WS_SYSTEM_EVENTS: ['open', 'close', 'error'],
    async ws (ws, req) {
        let obj = {};
        const controller = 'Socket';
        let ctx;

        let initProgress;
        const init = async token => {
            ctx = await utils.getWS(ws, req, token);
            if (ctx.err) return ctx.emit('error', ctx.err.toString(), 500);

            try {
                await load(controller, 'open', ctx, true);
            } catch (err) {
                if (err instanceof Array) { ctx.emit('error', ...err); }
                else { ctx.emit('error', err.toString(), 500); }
                return;
            }
        };

        obj.message = async msg => {
            const buf = Buffer.from(msg);
            const str = buf.toString();
            if (str.startsWith('token:')) {
                initProgress = init(str.slice(6));
                return;
            }

            if (initProgress) await initProgress;
            try {
                const parsed = JSON.parse(str);
                if (~parsed[0].indexOf(dispatch.WS_SYSTEM_EVENTS)) return;
                ctx._args = parsed.slice(1);
                await load(controller, parsed[0], ctx);
            } catch (err) {
                if (err instanceof Array) { ctx.emit('error', ...err); }
                else { ctx.emit('error', err.toString(), 500); }
            }
        }

        obj.error = async (code, msg) => {
            if (code != 1000 && code != 1001) {
                msg = Buffer.from(msg).toString();
                try {
                    if (ctx) {
                        ctx._args = [code, msg];
                        await load(controller, 'error', ctx);
                    }
                } catch (err) {
                    log.error('Unhandled socket error', `WebSocket disconnected with code ${code}\nDriver message: ${msg}`);
                }
            }

            if (ctx) await load(controller, 'close', ctx, true);
        }

        return obj;
    }
};

module.exports = dispatch;
