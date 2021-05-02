const http = require('http');
/**
 * Send request
 * @param {String} path
 * @param {'json' | 'urlencoded' | 'multipart'} type Payload type
 * @param {any} payload
 */
function request (path, type, payload) {
	const options = {
		method: payload ? 'POST' : 'GET'
	};

	// if (payload) {
	// 	options.headers = {
	// 		'Content-Type': 'appli'
	// 	};
	// }
	let resolve;
	const req = http.request('http://localhost:6080' + path, options, res => {
		const body = [];
		res.on('data', chunk => body.push(chunk));
		res.on('end', () => {
			resolve({
				code: res.statusCode,
				message: Buffer.concat(body)
			});
		});
	});

	if (payload) req.write(payload);
	req.end();

	return new Promise(resolver => resolve = resolver);
}

function requestJSON (path, payload) {
	return request(path, 'json', payload).then(result => {
		result.message = JSON.parse(result.message);
		return result;
	});
}

module.exports = {
	request,
	requestJSON,
	testJSON: async (path, code, message) => expect(await requestJSON(path)).toStrictEqual({ code, message }),
	testSocketEvent: (events, name, payload) => {
		return new Promise(resolve => {
			events.once(name, data => {
				expect(data).toStrictEqual(payload);
				resolve();
			})
		});
	}
};
