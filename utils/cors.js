const config = require('../config');

const info = {
	methods: 'GET,POST',
	headers: {
		allow: ['session', 'content-type'],
		expose: ['session', 'location']
	},
	ttl: '86400'
};

if (config.cors) {
	info.origin = config.cors.origin;

	if (config.cors.headers?.allow) {
		for (const header of config.cors.headers.allow) {
			info.headers.allow.push(header.toLowerCase());
		}
	}

	if (config.cors.headers?.expose) {
		for (const header of config.cors.headers.expose) {
			info.headers.expose.push(header.toLowerCase());
		}
	}

	if (config.cors.ttl) {
		info.ttl = config.cors.ttl.toString();
	}
}

const allowedHeaders = info.headers.allow.join(',');
const exposedHeaders = info.headers.expose.join(',');

module.exports = {
	preflight (req, res) {
		res.writeHeader('Access-Control-Allow-Methods', info.methods);
		res.writeHeader('Access-Control-Allow-Headers', allowedHeaders);
		res.writeHeader('Access-Control-Max-Age', info.ttl);
		res.writeHeader('Access-Control-Allow-Origin', info.origin || req.getHeader('origin'));
	},
	normal (req, res) {
		res.writeHeader('Access-Control-Allow-Origin', info.origin || req ? req.headers.origin : '*');
		res.writeHeader('Access-Control-Expose-Headers', exposedHeaders);
	}
};
