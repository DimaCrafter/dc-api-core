const { NatsController } = require('../../');

module.exports = class NatsTest extends NatsController {
    ping() {
        return 'pong';
    }

    echo() {
        console.log(typeof this.data, this.data);

        return this.data;
    }

    add() {
        const { a, b } = this.data;

        return { result: a + b };
    }
}
