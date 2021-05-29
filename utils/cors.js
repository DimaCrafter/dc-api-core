const config = require('../config');

let info = {
	methods: 'GET,POST',
	headers: ['content-type', 'session'],
	ttl: '86400'
};

if (config.cors) {
	info.origin = config.cors.origin;
	if (config.cors.headers) {
		for (const header of config.cors.headers) {
			info.headers.push(header.toLowerCase());
		}
	}
	// @ts-ignore
	info.headers = info.headers.join(',');

	if (config.cors.ttl) {
		info.ttl = config.cors.ttl.toString();
	}
}

module.exports = {
	preflight (req, res) {
		res.writeHeader('Access-Control-Allow-Methods', info.methods);
		res.writeHeader('Access-Control-Allow-Headers', info.headers);
		res.writeHeader('Access-Control-Max-Age', info.ttl);
		res.writeHeader('Access-Control-Allow-Origin', info.origin || req.getHeader('origin'));
	},
	normal (req, res) {
		res.writeHeader('Access-Control-Allow-Origin', info.origin || req ? req.headers.origin : '*');
		res.writeHeader('Access-Control-Expose-Headers', info.headers);
	}
};
