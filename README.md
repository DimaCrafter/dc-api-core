# Simple API core for your projects

[![NPM](https://nodei.co/npm/dc-api-core.png)](https://npmjs.com/package/dc-api-core)

## Dependencies

* [chalk](https://github.com/chalk/chalk)
* [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
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

Information about [code styling are available here](docs/CodeStyling.md).

[API Client you can find here](docs/Client.md)

---

## Easy installation

1) Install package - `npm i dc-api-core --save` or `yarn add dc-api-core`
2) Change start script in `package.json` to `dc-api-core`
3) Fill `config.json`
4) Done!

## CLI

You can use `dc-api-core` command locally is `package.json` scripts.

Options:

* No options - Just running your project
* `--dev` - Running project with nodemon.
* `--cfg <path>` - Overrides `config.json` location. You can use both relative and absolute paths.

---

## `config.json`

| Field                 | Default             | Description                                  |
|-----------------------|---------------------|----------------------------------------------|
| `db`                  | Optional            | Object                                       |
| `db[driverName]`      |                     | Code of [database driver](#DB-module)        |
| `db[driverName].name` | Required            | Database name                                |
| `db[driverName].port` | Defined by plugin   | Database port                                |
| `db[driverName].user` | Optional            | Database username                            |
| `db[driverName].pass` |                     | and password                                 |
|                       |                     |                                              |
| `session.secret`      | Required            | Private string for cookie                    |
| `session.store`       | Required            | Database config name                         |
| `session.ttl`         | `3d` (3 days)       | Session lifetime in [zeit/ms] format         |
|                       |                     |                                              |
| `ssl`                 | Optional            | Enables HTTPS mode if filled                 |
| `ssl.*`               | Optional            | Any `uWS.SSLApp` options field               |
| `ssl.key`             | Required            | Local path to private key                    |
| `ssl.cert`            | Required            | Local path to certificate file               |
|                       |                     |                                              |
| `plugins`             | `[]`                | Array of plugin packages names               |
| `devMode`             | `false`             | DEPRECATED, use CLI instead                  |
| `ignore`              | `[]`                | Excluded directories in development mode     |
| `origin`              | `Origin` header     | Accept requests only from this origin        |
| `port`                | `8081`              | API listing port                             |
| `ws_timeout`          | `60`                | WebSocket request waiting timeout in seconds |

[zeit/ms]: https://github.com/zeit/ms

Example:

```json
{
    "port": 443,
    "db": {
        "mongo": {
            "host": "localhost",
            "name": "test-db"
        }
    },
    "plugins": ["dc-api-mongo"],
    "session": {
        "secret": "super secret string",
        "store": "mongo"
    },
    "ssl": {
        "cert": "/etc/letsencrypt/live/awesome.site/cert.pem",
        "key": "/etc/letsencrypt/live/awesome.site/privkey.pem"
    }
}
```

---

## DB module

```ts
require('dc-api-core/DB'): {
    [string: code]: (config?: string) => DBDriver
}
```

* `code` - Registered code of database driver. For example `dc-api-mongo` registers `mongo`.
* `config` - Configuration name after dot in `config.json`. Ex. `mongo('dev')` points to `db['mongo.dev']`.
* `DBDriver` - Mongoose-like object (not always, defined by plugin)

## Plugins

For first, install plugin package via `npm` or `yarn`.
After this add name of plugin package to `plugins` array in `config.json`.

Example `config.json`:

```js
{
    // ...
    plugins: ["dc-api-mongo"]
}
```

If you want create your own plugin, read [plugin development documentation](docs/Plugins.md)

---

## My TODOs

* [ ] Normal controller context
* [ ] Support for serving SPA
* [ ] Typing (`.d.ts` files)
* [ ] WebSocket fallback (like socket.io)
* [ ] Redirect from HTTP to HTTPS (80 -> 443)
* [ ] Normal documentation (GitHub wiki or more `.md` files in `/docs`)
* [ ] Routing rules & middlewares
* [ ] Local/remote (git) plugins and middlewares support
