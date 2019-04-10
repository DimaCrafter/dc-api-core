# Simple API core for your projects

[![NPM](https://nodei.co/npm/dc-api-core.png)](https://npmjs.com/package/dc-api-core)

## Dependencies

* [chalk](https://github.com/chalk/chalk)
* [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js)

---

## Structure

```txt
📙
 ├── ⚙️ controllers      Request controllers
 ├── 🗃️ models           Models for working with DB
 │   └── 📁 <driver>     Database driver name (Optional)
 │       └── 📜 <model>  Model name (js or json)
 ├── 🔑 sessions         Sessions storage
 ├── ️📃 config.json      Configuration file
 └── ⏱ startup.js       Script, that was started before strting API server
```

Information about [code styling are available here](docs/CodeStyling.md)

---

## Easy installation

1) Install package - `npm i dc-api-core --save` or `yarn add dc-api-core`
2) Change start script in `package.json` to `node node_modules/dc-api-core`
3) Fill `config.json`
4) Done!

If you want change `config.json` location or name, you should
change start script to `node node_modules/dc-api-core --cfg /path/to/config.json`

For best development I recommend you to use [nodemon].
You can install this by executing `npm i -g nodemon` or `yarn global add nodemon`.
After this change `node` to `nodemon --ignore sessions/` in start script in your `package.json`.

---

## `config.json`

| Field                 | Default             | Description                                  |
|-----------------------|---------------------|----------------------------------------------|
| `db`                  | Optional            | Object                                       |
| `db[driverName]`      |                     | Name of [database driver](#plugins)          |
| `db[driverName].name` | Required            | Database name                                |
| `db[driverName].port` | Defined by plugin   | Database port                                |
| `db[driverName].user` | Optional            | Database username                            |
| `db[driverName].pass` |                     | and password                                 |
|                       |                     |                                              |
| `session.secret`      | Required            | Private string for cookie                    |
| `session.ttl`         | `36`                | Cookie TTL in hours                          |
|                       |                     |                                              |
| `ssl`                 | Optional            | Enables HTTPS mode if filled                 |
| `ssl.key`             | Required            | Local path to private key                    |
| `ssl.cert`            | Required            | Local path to certificate file               |
|                       |                     |                                              |
| `devMode`             | `false`             | DEPRECATED, use [nodemon] instead            |
| `origin`              | `Origin` header     | Accept requests only from this origin        |
| `port`                | `8081`              | API listing port                             |
| `ws_timeout`          | `60`                | WebSocket request waiting timeout in seconds |

[nodemon]: https://github.com/remy/nodemon

---

<tag id="plugins" />

## Database driver and plugins

Drivers can be defines by plugins, that named like `dc-api-pluginName`.
For example, official plugin `dc-api-mysql`.

For first, install plugin package via `npm` or `yarn`.
Arter this add name of plugin package to `plugins` array in `config.json`.

Database plugins registers their middleware in `this.db` array (controller function scope),
but other plugins can define this anywhere.

If you want create your own plugin, read [plugin developing documentation](docs/Plugins.md)
