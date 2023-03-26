const errorHandlers = [];
exports.onError = handler => errorHandlers.push(handler);
exports.emitError = info => {
	for (const handler of errorHandlers) {
		handler(info);
	}
};

exports.HttpError = class HttpError {
    constructor (message, code = 500) {
        this.message = message;
        this.code = code;
    }
}

const INTERNAL_REGEXP = /(.+\(internal\/modules\/|\s*at internal\/|.+\(node:).+(\n|$)/g;
exports.clearErrorStack = stack => {
	return stack.replace(INTERNAL_REGEXP, '');
};

exports.splitError = error => {
	// Error stack also includes message
	return (error.stack ? exports.clearErrorStack(error.stack) : error.toString()).trim().split('\n');
};
