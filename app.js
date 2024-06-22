const uWS = require('uWebSockets.js');

const config = require('./config');
const cors = require('./utils/cors');


/** @type {uWS.TemplatedApp} */
let app;
if (config.ssl) {
	const opts = { ...config.ssl };
	opts.cert_file_name = opts.cert_file_name || opts.cert;
	opts.key_file_name = opts.key_file_name || opts.key;
	app = uWS.SSLApp(opts);
} else {
	app = uWS.App();
}

// CORS preflight request
app.options('/*', (res, req) => {
	cors.preflight(req, res);
	res.writeStatus('200 OK');
	res.end();
});

module.exports = app;
