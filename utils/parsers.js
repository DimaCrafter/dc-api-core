const { getParts } = require('uWebSockets.js');

// TODO: arrays and objects support
function parseQueryString (value) {
	const result = {};
	for (const pair of value.split('&')) {
		if (!pair) continue;
		let eqPos = pair.indexOf('=');
		if (~eqPos) {
			result[pair.slice(0, eqPos)] = decodeURIComponent(pair.slice(eqPos + 1));
		} else {
			result[pair] = true;
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

module.exports = { parseQueryString, parseMultipart, parseIPv6Part };
