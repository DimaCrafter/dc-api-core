const { getParts } = require('uWebSockets.js');

function parseQueryString (query) {
	const result = {};
	for (const [key, value] of new URLSearchParams(query)) {
		if (value === '' || value == 'true' || value == 'yes') {
			result[key] = true;
		} else if (value == 'false' || value == 'no') {
			result[key] = false;
		} else {
			result[key] = value;
		}
	}

	return result;
}

function parseMultipart (body, type) {
	const result = {};
	for (const part of getParts(body, type)) {
		result[part.name] = {
			name: part.filename || part.name,
			type: part.type,
			content: Buffer.from(part.data)
		};
	}

	if (result.json) {
		const parsed = result.json.content.toString();
		Object.assign(result, JSON.parse(parsed));
		delete result.json;
	}

	return result;
}

/**
 * @param {number} part
 */
function parseIPv6Part (part) {
    let result = part.toString(16);
    if (result[1]) return result;
    else return '0' + result;
}

/** @typedef {(req: import('../contexts/http').Request, body: Buffer) => { body: any, error?: undefined } | { error: Error, message: string }} HttpBodyParser */
/** @type {{ [type: string]: HttpBodyParser }} */
const HTTP_TYPES = {
	'application/json' (_req, body) {
		try {
			return { body: JSON.parse(body.toString()) };
		} catch (error) {
			return { error, message: 'Incorrect JSON body: ' + error.message };
		}
	},
	'application/x-www-form-urlencoded' (_req, body) {
		return { body: parseQueryString(body.toString()) };
	},
	'multipart/form-data' (req, body) {
		try {
			// Only JSON error can be thrown from this parser
			return { body: parseMultipart(body, req.headers['content-type']) };
		} catch (error) {
			return { error, message: 'Incorrect `json` field: ' + error.message };
		}
	}
};

/**
 * @param {string} type Content-Type header value
 * @param {HttpBodyParser} parser
 */
function registerContentType (type, parser) {
	HTTP_TYPES[type] = parser;
}

module.exports = {
	HTTP_TYPES, registerContentType,
	parseQueryString, parseMultipart, parseIPv6Part
};
