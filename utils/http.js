const { emitError } = require('../errors');
const { parseQueryString, HTTP_TYPES } = require('./parsers');
const CORS = require('./cors');

/**
 * Parses `req` data and makes it stored in `out`
 * @argument {import('uWebSockets.js').HttpRequest} req
 * @argument {Object} out
 */
function parseRequest (req, out) {
	out.query = parseQueryString(req.getQuery());
	out.headers = {};
	req.forEach((name, value) => out.headers[name] = value);
}

/**
 * Parses request and setting common fields in response
 * @argument {import('uWebSockets.js').HttpRequest} req
 * @argument {import('uWebSockets.js').HttpResponse} res
 */
function prepareHttpConnection (req, res) {
	res.aborted = false;
	res.onAborted(() => res.aborted = true);
	req.path = req.getUrl();
	parseRequest(req, req);

	res.headers = {};
}

async function fetchBody (req, res) {
	let contentType = req.headers['content-type'];
	if (!contentType) {
		return abortRequest(res, 400, 'Content-Type header is required');
	}

	const delimIndex = contentType.indexOf(';');
	if (delimIndex != -1) contentType = contentType.slice(0, delimIndex);
	contentType = contentType.toLowerCase();

	const bodySize = parseInt(req.headers['content-length']);
	if (Number.isNaN(bodySize)) {
		return abortRequest(res, 400, 'Content-Length header is invalid');
	}

	const parseBody = HTTP_TYPES[contentType];
	if (parseBody) {
		const rawBody = await getBody(res, bodySize);
		const result = parseBody(req, rawBody);
		if (result.error) {
			emitError({
				isSystem: true,
				type: 'RequestError',
				code: 400,
				url: req.path,
				message: result.message,
				error: result.error,
				body: rawBody
			});

			return abortRequest(res, 400, result.message);
		} else {
			req.body = result.body;
		}
	} else {
		emitError({
			isSystem: true,
			type: 'RequestError',
			code: 400,
			url: req.path,
			message: `Content-Type "${contentType}" not supported`
		});

		return abortRequest(res, 400, 'Content-Type not supported');
	}
}

function abortRequest (res, code, message) {
	if (res.aborted) return;
	res.cork(() => {
		res.writeStatus(getResponseStatus(code));
		res.writeHeader('Content-Type', 'text/plain');
		CORS.normal(null, res);
		res.end(message);
	});

	res.aborted = true;
}

/**
 * Reads body buffer from request (response in uWS)
 * @param {import('uWebSockets.js').HttpResponse} res
 * @returns {Promise<Buffer>}
 */
function getBody (res, size) {
	return new Promise(resolve => {
		const result = Buffer.allocUnsafe(size);
		let offset = 0;
		res.onData((chunk, isLast) => {
			chunk = new Uint8Array(chunk);
			for (let i = 0; i < chunk.byteLength; i++) {
				result[offset + i] = chunk[i];
			}

			offset += chunk.byteLength;

			if (isLast) resolve(result);
		});
	});
}

/**
 * Returns HTTP response status line for passed numeric code
 * @param {Number} code HTTP response code
 * @returns {String}
 */
function getResponseStatus (code) {
    switch (code) {
        case 200: return '200 OK';
        case 201: return '201 Created';
        case 202: return '202 Accepted';
        case 203: return '203 Non-Authoritative Information';
        case 204: return '204 No Content';
        case 205: return '205 Reset Content';
        case 206: return '206 Partial Content';

        case 301: return '301 Moved Permanently';
        case 302: return '302 Found';
        case 303: return '303 See Other';
        case 304: return '304 Not Modified';
        case 307: return '307 Temporary Redirect';

        case 400: return '400 Bad Request';
        case 401: return '401 Unauthorized';
        case 403: return '403 Forbidden';
        case 404: return '404 Not Found';
        case 405: return '405 Method Not Allowed';
        case 406: return '406 Not Acceptable';
        case 408: return '408 Request Timeout';
        case 409: return '409 Conflict';
        case 410: return '410 Gone';
        case 415: return '415 Unsupported Media Type';

        case 500: return '500 Internal Server Error';
        case 501: return '501 Not Implemented';
        default: return code.toString();
    }
}

module.exports = {
	parseRequest,
	fetchBody,
	prepareHttpConnection,
	abortRequest,
	getResponseStatus
};
