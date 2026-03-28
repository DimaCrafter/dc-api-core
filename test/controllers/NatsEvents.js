const { NatsSubscription } = require('../../');

module.exports = class NatsEvents extends NatsSubscription {
    notify() {
        const message = this.data;

        console.log(message);

        this.publish(`nats-events.notify.replies`, { message, ts: Date.now() });
    }
}
