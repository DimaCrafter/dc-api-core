const { connect } = require('nats');

let nc;

beforeAll(async () => {
    nc = await connect({ servers: 'nats://localhost:4222' });
});

afterAll(async () => {
    await nc.drain();
});

function request(subject, data) {
    const payload = Buffer.from(JSON.stringify(data ?? ''));
    return nc.request(subject, payload, { timeout: 3000 }).then(msg => {
        return JSON.parse(Buffer.from(msg.data).toString());
    });
}

test('ping returns pong', async () => {
    const result = await request('nats-test.ping');
    expect(result).toBe('pong');
});

test('echo returns payload', async () => {
    const result = await request('nats-test.echo', { hello: 'world' });
    expect(result).toStrictEqual({ hello: 'world' });
});

test('add returns sum', async () => {
    const result = await request('nats-test.add', { a: 3, b: 4 });
    expect(result).toStrictEqual({ result: 7 });
});
