const config = require('../config.json');
const WebSocket = require('ws');
const EventEmitter = require('events');
const { testSocketEvent } = require('./utils');

let events = new EventEmitter();
const connection = new WebSocket('ws://localhost:' + config.port + '/socket');
connection.on('message', data => {
	/** @type {[string]} */
	const eventData = JSON.parse(data.toString());
	events.emit(...eventData);
});

const testEvent = (name, payload) => testSocketEvent(events, name, payload);

test('Connection handler', () => {
	return testEvent('open-reply');
});

test('Simple event', () => {
	connection.send('["sum",2,3,7]');
	return testEvent('sum', 12);
});

afterAll(() => {
	connection.close();
});
