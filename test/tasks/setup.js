const { spawn } = require('child_process');
const config = require('../config.json');

module.exports = () => {
	server = spawn('node', ['..'], { stdio: ['ignore', 'pipe', 'ignore'] });
	return new Promise(done => {
		let httpReady = config.port === false;
		let natsReady = !config.nats;

		server.stdout.on('data', chunk => {
			const text = chunk.toString();
			if (!httpReady && text.includes('Server started on port ' + config.port)) {
				httpReady = true;
			}
			if (!natsReady && text.includes('NATS connected to')) {
				natsReady = true;
			}
			if (httpReady && natsReady) {
				global.SERVER = server;
				done();
			}
		});
	});
}
