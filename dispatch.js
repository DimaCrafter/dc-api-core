const ROOT = process.cwd();
const utils = require('./utils');
const path = require('path');
const fs = require('fs');

async function getController (controller) {
    controller = controller.charAt(0).toUpperCase() + controller.slice(1);
    return new Promise((resolve, reject) => {
        const controllerPath = path.normalize(`${ROOT}/controllers/${controller}.js`);
        fs.access(controllerPath, fs.constants.F_OK | fs.constants.W_OK, (err) => {
            if(err && err.code == 'ENOENT') reject([`API ${controller} controller not found`, 404]);
            else if(err) reject([`Can't access ${controller} controller`, 403]);
            else {
                let controller = require(controllerPath);
                controller = new controller();
                resolve(controller);
            }
        });
    });
}

async function load (controller, action, ctx, isOptional = false) {
    try { controller = await getController(controller); }
    catch(err) { throw err; }

    if (controller.onLoad && controller.onLoad.apply(ctx)) return;
    if (action in controller) return controller[action].apply(ctx, ctx._args);
    else if (!isOptional) throw [`API ${controller.constructor.name}.${action} action not found`, 404];
}

const dispatch = {
    async http (req, res) {
        // Getting controller and action from path
        let [controller, action] = req.path.split('/').slice(1);
        const ctx = await utils.getHTTP(req, res);
        if (ctx.err) return ctx.send(ctx.err, 500);

        try {
            await load(controller, action, ctx);
        } catch (err) {
            if (err instanceof Array) { ctx.send(...err); }
            else { ctx.send(err.toString(), 500); }
            return;
        }
    },

    async ws (ws, req) {
        let obj = {};
        const controller = 'Socket';
        const ctx = await utils.getWS(ws, req);
        if (ctx.err) return ctx.emit('error', ctx.err.toString(), 500);

        try {
            await load(controller, 'open', ctx, true);
        } catch (err) {
            if (err instanceof Array) { ctx.emit('error', ...err); }
            else { ctx.emit('error', err.toString(), 500); }
            return;
        }

        obj.message = async msg => {
            msg = JSON.parse(Buffer.from(msg));
            if (msg[0] == 'open') return;
            
            try {
                await load(controller, msg[0], {
                    _replyEvent: msg[0],
                    _args: msg.slice(1),
                    ...ctx
                });
            } catch (err) {
                if (err instanceof Array) { ctx.emit('error', ...err); }
                else { ctx.emit('error', err.toString(), 500); }
            }
        }

        obj.error = async (code, msg) => {
            try {
                await load(controller, 'error', {
                    _args: [code, msg],
                    ...ctx
                });
            } catch (err) {
                msg = Buffer.from(msg);
                log.error('Unhandled socket error', `WebSocket disconnected with code ${code}\nDriver message: ${msg}`);
            }
        }
    }
};

module.exports = dispatch;
