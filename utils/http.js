const config = require('../config');
const { emitError } = require('..');
const { parseQueryString, parseMultipart } = require('./parsers');

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
	res.headers['Access-Control-Allow-Origin'] = config.origin || req.headers.origin;
	res.headers['Access-Control-Expose-Headers'] = 'session';
}

async function fetchBody (req, res) {
	let contentType = req.headers['content-type'];
	if (!contentType) {
		return abortRequest(res, 400, 'Content-Type header is required');
	}

	const delimIndex = contentType.indexOf(';');
	if (~delimIndex) contentType = contentType.slice(0, contentType.indexOf(';'));
	contentType = contentType.toLowerCase();

	const body = await getBody(res)
	switch (contentType) {
		case 'application/json':
			try {
				// @ts-ignore
				req.body = JSON.parse(body);
			} catch (error) {
				emitError({
					isSystem: true,
					type: 'RequestError',
					code: 400,
					url: req.path,
					message: 'Incorrect JSON body',
					error,
					body
				});

				return abortRequest(res, 400, 'Incorrect JSON body');
			}
			break;
		case 'application/x-www-form-urlencoded':
			req.body = parseQueryString(body.toString());
			break;
		case 'multipart/form-data':
			try {
				// Only JSON error can be thrown from this parser
				req.body = parseMultipart(body, req.headers['content-type']);
			} catch (error) {
				emitError({
					isSystem: true,
					type: 'RequestError',
					code: 400,
					url: req.path,
					message: 'Incorrect `json` field',
					error,
					body
				});

				return abortRequest(res, 400, 'Incorrect `json` field');
			}
			break;
		default:
			emitError({
				isSystem: true,
				type: 'RequestError',
				code: 400,
				url: req.path,
				message: 'Content-Type not supported',
				value: contentType
			});

			return abortRequest(res, 400, 'Content-Type not supported');
	}
}

function abortRequest (res, code, message) {
	if (res.aborted) return;
	res.cork(() => {
		res.writeStatus(getResponseStatus(code));
		res.writeHeader('Content-Type', 'application/json');
		res.end('"' + message + '"');
	});

	res.aborted = true;
}

/**
 * Reads body buffer from request (response in uWS)
 * @param {import('uWebSockets.js').HttpResponse} res
 * @returns {Promise<Buffer>}
 */
function getBody (res) {
	return new Promise(resolve => {
		const parts = [];
		res.onData((chunk, isLast) => {
			parts.push(Buffer.from(chunk));
			if (isLast) resolve(Buffer.concat(parts));
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
