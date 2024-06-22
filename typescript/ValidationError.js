const { HttpError } = require('../errors');


module.exports = class ValidationError extends HttpError {
	name = 'ValidationError';

	/**
	 * @param {string} message
	 * @param {string=} field
	 */
	constructor (message, field) {
		super({ type: 'ValidationError', field, message }, 400);
	}

	toString () {
		return this.message.field
			? `[ValidationError] ${this.message.field}: ${this.message.message}`
			: `[ValidationError] ${this.message.message}`;
	}
};
