# Simple API core for your projects

[![NPM](https://nodei.co/npm/dc-api-core.png)](https://npmjs.com/package/dc-api-core)

## Dependencies

* [connect-mongo](https://github.com/kcbanner/connect-mongo)
* [Express](https://github.com/expressjs/express)
* [express-session](https://github.com/expressjs/session)
* [express-ws](https://github.com/HenningM/express-ws)
* [Mongoose](https://github.com/Automattic/mongoose)
* [mongoose-auto-increment](https://github.com/codetunnel/mongoose-auto-increment)

---

## Structure

```txt
📙
 ├── ⚙️ controllers   Request controllers
 ├── 🗃️ models        Models for working with DB
 ├── ️📃 config.json   Configuration file
 └── ⏱ startup.js    Script, that was started before initializing API
```

---

## Easy installation

1) Install package - `npm i dc-api-core --save` or `yarn add dc-api-core`
2) Change start script in `package.json` to `node node_modules/dc-api-core`
3) Fill `config.json`
4) Done!

If you want change `config.json` location or name, you should
change start script to `node node_modules/dc-api-core --cfg /path/to/config.json`

---

## config.json

| Variable         | Default       | Description                                                  |
|------------------|---------------|--------------------------------------------------------------|
| `db.host`        | Required      | Database hostname or IP                                      |
| `db.name`        | Required      | Database name                                                |
| `db.port`        | `27017`       | Database port                                                |
| `db.user`        | Optional      | Database username                                            |
| `db.pass`        |               | and password                                                 |
|                  |               |                                                              |
| `session.secret` | Required      | Private string for cookie                                    |
| `session.ttl`    | `36`          | Cookie TTL in hours                                          |
|                  |               |                                                              |
| `ssl`            | Optional      | Enables HTTPS mode if filled                                 |
| `ssl.key`        | Required      | Local path to private key                                    |
| `ssl.cert`       | Required      | Local path to certificate file                               |
|                  |               |                                                              |
| `devMode`        | `false`       | If `true` controllers and models refreshing on every request |
| `port`           | `8081`        | API listing port                                             |
| `ws_timeout`     | `60`          | WebSocket request waiting timeout in seconds                 |