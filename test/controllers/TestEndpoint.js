module.exports = class TestEndpoint {
	ping () {
		return 'pong';
	}

	get () {
		return this.query;
	}

	post () {
		return this.data;
	}

	hash () {
		return this.params.hash;
	}

	_private () { return 'secured content'; }
	exposedPrivate () { return this.controller._private(); }
}
