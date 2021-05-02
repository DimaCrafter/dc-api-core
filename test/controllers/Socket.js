module.exports = class Socket {
	open () {
		this.emit('open-reply');
	}

	sum (...args) {
		this.emit('sum', args.reduce((prev, curr) => prev + curr));
	}
}
