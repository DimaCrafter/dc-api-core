module.exports = class Socket {
	open () {
		this.emit('open-reply');
	}

	sum (...args) {
		this.emit('sum', args.reduce((prev, curr) => prev + curr));
	}

	sub_test () {
		this.subscribe('test-channel');
		setTimeout(() => this.broadcast('test-channel', 'sub_test', 'Channeling works!'), 1000);
	}
}
