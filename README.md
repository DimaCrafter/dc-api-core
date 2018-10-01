# Simple API core for your projects

[![NPM](https://nodei.co/npm/dc-api-core.png)](https://npmjs.com/package/dc-api-core)

## Dependencies

* [Express](https://github.com/expressjs/express)
* [MongoDB](https://github.com/mongodb/mongo)
* [Mongoose](https://github.com/Automattic/mongoose)

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

1) Install package - `npm i dc-api-core --save`
2) Change start script in `package.json` to `node node_modules/dc-api-core`
3) Fill `config.json`
4) Done!

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
| `devMode`        | `false`       | If `true` controllers and models refreshing on every request |
| `port`           | `8081`        | API listing port                                             |