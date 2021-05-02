const { spawn } = require('child_process');
const config = require('../config.json');

module.exports = () => {
	server = spawn('node', ['..'], { stdio: ['ignore', 'pipe', 'ignore'] });
	return new Promise(done => {
		server.stdout.on('data', chunk => {
			if (~chunk.toString().indexOf('Server started on port ' + config.port + ' without SSL')) {
				global.SERVER = server;
				done();
			}
		});
	});
}
