const ROOT = process.cwd();
const config = require('./config');

const {getHTTPUtils, getWSUtils} = require('./utils');
const path = require('path');
const fs = require('fs');

async function getController(controller) {
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

async function load(controller, action, utils) {
    try { controller = await getController(controller); }
    catch(err) { throw err; }

    controller.onLoad && controller.onLoad.apply(utils);
    if (action in controller) return controller[action].apply(utils);
    else throw [`API ${controller.constructor.name}.${action} action not found`, 404];
}

const dispatch = {
    async http(req, res) {
        // Getting controller and action from path
        let [controller, action] = req.path.split('/').slice(1);
        const utils = getHTTPUtils(req, res, this.db);
        try {
            await load(controller, action, utils);
        } catch(err) {
            console.log(err);
            utils.send(...err);
            return;
        }
    },

    async ws(req, ws) {
        const utils = getWSUtils(ws, req, this.db);
        // Waiting first message with dispatch information
        const timeout = setTimeout(() => {
            utils.send('connection_timeout', false);
            utils.close();
            ws.off('message', onData);
        }, (config.ws_timeout || 60) * 1000);

        const onData = async req => {
            clearTimeout(timeout);
            try {
                req = JSON.parse(req);
            } catch {
                utils.send('wrong_request', 400);
                return;
            }

            try {
                utils.data = req.data;
                await load(req.controller, req.action, utils);
            } catch(err) {
                if(err instanceof Array) { utils.end(...err); }
                else { utils.end(err, 500); }
                return;
            }
        };
        ws.once('message', onData);
    }
};

module.exports = dispatch;
