# Simple API core for your projects

[![NPM](https://nodei.co/npm/dc-api-core.png)](https://npmjs.com/package/dc-api-core)

## Useful links

![Documentation image](https://user-images.githubusercontent.com/10772852/116776513-d4a0ba00-aa79-11eb-99c5-a42592b0bd2d.png)

* [Documentation](http://dimacrafter.github.io/dc-api-core)
* [dc-api-cli](https://github.com/DimaCrafter/dc-api-cli) - CLI toolkit
* [dc-api-client](https://github.com/DimaCrafter/dc-api-client) - API client
* [dc-api-mongo](https://github.com/DimaCrafter/dc-api-mongo) - Mongoose based MongoDB driver
* [Examples](https://github.com/mayerdev/dc-api-examples)

## Dependencies

* [jwa](https://github.com/auth0/node-jwa)
* [vercel/ms](https://github.com/vercel/ms)
* [μWebSockets.js](https://github.com/uNetworking/uWebSockets.js)
* [watch](https://github.com/mikeal/watch)

---

## Structure

```txt
📙
 ├── ⚙️ controllers      Request controllers
 ├── 🗃️ models           Models for working with DB
 │   └── 📁 <driver>     Database driver name (Optional)
 │       └── 📜 <model>  Model name (js or json)
 ├── ️📃 config.json      Configuration file
 └── ⏱ startup.js       Script, that was started before starting API server
```

---

## Installation

**0)** Run `npm init` or `yarn init`

**1)** Install package - `npm i dc-api-core --save` or `yarn add dc-api-core`

**2)** Run `npm exec dc-api-core init` or `yarn dc-api-core init`

**3)** Run `npm run dc-init` or `yarn dc-init`

**4)** Run `npm start` or `yarn start`

**5)** Done!

## CLI

You can use `dc-api-core` command locally in `package.json` scripts.

Options:

* No options - Just running your project.
* `init` - Create example files and start scripts.
* `--dev` - Running project in development mode.
* `--cfg <path>` - Overrides `config.json` location. You can use both relative and absolute paths.

---

## `config.json`

| Field                 | Default             | Description                                  |
|-----------------------|---------------------|----------------------------------------------|
| `db`                  | Optional            | Object                                       |
| `db[driverName]`      |                     | Code of [database driver](#db-module)        |
| `db[driverName].name` | Required            | Database name                                |
| `db[driverName].port` | Defined by plugin   | Database port                                |
| `db[driverName].user` | Optional            | Database username                            |
| `db[driverName].pass` |                     | and password                                 |
| `db[driverName].srv`  | Optional for mongo  | Boolean, `true` - use `srv`                  |
|                       |                     |                                              |
| `session.secret`      | Required            | Private string for cookie                    |
| `session.store`       | Required            | Database config name                         |
| `session.ttl`         | `3d` (3 days)       | Session lifetime in [vercel/ms] format       |
|                       |                     |                                              |
| `ssl`                 | Optional            | Enables HTTPS mode if filled                 |
| `ssl.*`               | Optional            | Any `μWS.SSLApp` options field               |
| `ssl.key`             | Required            | Local path to private key                    |
| `ssl.cert`            | Required            | Local path to certificate file               |
|                       |                     |                                              |
| `plugins`             | `[]`                | Array of plugin packages names               |
| `origin`              | `Origin` header     | Accept requests only from this origin        |
| `port`                | `8081`              | API listing port                             |
| `ws_timeout`          | `60`                | WebSocket request waiting timeout in seconds |
|                       |                     |                                              |
| `ignore`              | `[]`                | Excluded directories in development mode     |
| `isDev`               | Read-only           | `true` if using `--dev` argument             |
| `dev`                 | `{}`                | Config to merge if `isDev` is `true`         |
| `ttl`                 | `0`                 | WebSocket TTL in seconds, `0` - disabled     |

[vercel/ms]: https://github.com/vercel/ms

Example:

```js
{
    "port": "$env", // Equals value of process.env.PORT
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
    },
    "dev": {
        "port": 8081,
        "db": {
            "mongo": { "name": "test-dev-db" }
        }
    }
}
```

---

## DB module

```ts
require('dc-api-core/DB'): {
    [string: code]: (config?: string, template?: Object) => DBDriver
}
```

* `code` - Registered code of database driver. For example `dc-api-mongo` registers `mongo`.
* `config` - Configuration name after dot in `config.json`. Ex. `mongo('dev')` points to `db['mongo.dev']`.
* `template` - Object that overrides selected configuration.
* `DBDriver` - Mongoose-like object (not always, defined by plugin)

Example:

```js
const db = require('dc-api-core/DB').mongo();
```

Where `mongo` - your database driver name.

Example:
If you're using MySQL, use `mysql` as database driver (don't forget to apply plugin first).

```js
const db = require('dc-api-core/DB').mysql();
```

## Plugins

For first, install plugin package via `npm` or `yarn`.
After this add name of plugin package to `plugins` array in `config.json`.

Example `config.json`:

```js
{
    // ...
    "plugins": ["dc-api-mongo"]
}
```

If you want create your own plugin, read
[plugin development documentation](https://dimacrafter.github.io/dc-api-core/en/plugins/basics.html)

---

## Sessions

### Functions

| Function                 | Example                        | Description            |
|--------------------------|--------------------------------|------------------------|
| `this.session.<name>`    | `this.session.name = 'User'`   | Set session data       |
| `this.session.save()`    | `await this.session.save()`    | Save session data      |
| `this.session.destroy()` | `await this.session.destroy()` | Clear all session data |

#### Example

```js
module.exports = class Controller {
    async test () {
        this.session.name = 'test';
        await this.session.save();
        this.send('saved');
    }
}
```

## Request hooks

### onLoad

Will be executed before calling action method in controller.

If the `onLoad` function returns false, the request will be rejected.

#### Example

```js
module.exports = class Test {
    onLoad () {
        if (!this.session.user) return false;
    }
}
```

## Working with config.json

### Require

Require config module:

```js
const config = require('dc-api-core/config');
```

Get data:

```js
config.<your_param>
```

#### Example

```js
const config = require('dc-api-core/config');

module.exports = class Test {
    index() {
     this.send(config.myParam);
    }
}
```

## Routing

Register route in startup script:

```js
// startup.js
const Router = require('dc-api-core/router');
Router.register('/testing/files/${id}/${file}.jpg', 'Test.getFile');
```

Now requests like `/testing/files/some-id/secret_file.jpg` will call `getFile` method of `Test` controller.

```js
// controllers/Test.js
class Test {
    async getFile () {
        this.send(this.params);
        // Will send { "id": "some-id", "file": "secret_file" }
    }
}

module.exports = Test;
```

## My TODOs

* [ ] Support for glibc < 2.18
* [ ] Typing (`.d.ts`) files
* [ ] Automatic package publication when all tests are passed
* [ ] More functionality tests
* [ ] Clusterization/multi-threading support
