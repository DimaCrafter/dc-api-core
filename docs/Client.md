# API Client

```js
// In browser you can connect axios by script tag and use EventEmitter polyfill
import axios from 'axios'
import { EventEmitter } from 'events';

let settings = {
    base: window.location.hostname,
    secure: true
};

function sendAPI (controller, action, data = {}) {
    return new Promise(resolve => {
		const url = `${settings.secure ? 'https': 'http'}://${settings.base}/${controller}/${action}`;
		const headers = {};
		headers['content-type'] = 'application/json';
		const token = localStorage.getItem('token');
		if (token) headers.token = token;

        axios.post(url, JSON.stringify(data), { headers }).then(
            res => {
				if (res.headers.token) localStorage.setItem('token', res.headers.token);
				resolve(res.data);
			},
            err => err.response ? resolve(err.response.data) : resolve({ success: false, code: 0, msg: err.message })
        );
    });
}

let socket = null;
let socketEmitter = new EventEmitter();
socketEmitter.__emit = socketEmitter.emit;
socketEmitter.emit = (...args) => socket.send(JSON.stringify(args));

const API = new Proxy({ settings }, {
    get (obj, controller) {
        if (controller in obj) return obj[controller];
        if (controller == 'socket') {
            if (!socket) {
                socket = new WebSocket(`${settings.secure ? 'wss': 'ws'}://${settings.base}/socket`);
                socket.onopen = () => socketEmitter.__emit('open');
                socket.onmessage = e => {
                    const args = JSON.parse(e.data);
                    if (args.event == 'token') localStorage.setItem('token', args.msg);
                    socketEmitter.__emit(args.event, args);
                };
                socket.onerror = err => socketEmitter.__emit('error', err);
                socket.onclose = e => {
                    socketEmitter.__emit('close', e);
                    socket = null;
                };
            }
            return socketEmitter;
        }

        return new Proxy({}, {
            get (obj, action) {
                return data => sendAPI(controller, action, data);
            }
        });
    }
});

window.API = API;
export default API
```