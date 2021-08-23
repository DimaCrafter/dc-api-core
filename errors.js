const errorHandlers = [];
function emitError (info) {
	for (const handler of errorHandlers) {
		handler(info);
	}
}

class HttpError {
    constructor (message, code = 500) {
        this.message = message;
        this.code = code;
    }
}

exports.HttpError = HttpError;
exports.emitError = emitError;
exports.onError = handler => errorHandlers.push(handler);
