# Database plugins

Coming soon, but if you want do this now, you can try to understand [dc-api-mongo] plugin

<!-- [dc-api-mysql]: https://github.com/DimaCrafter/dc-api-mysql -->
[dc-api-mongo]: https://github.com/DimaCrafter/dc-api-mongo

## Sketch of documentation

This pseudo-code created to show how this works. I don't know how make mornal documentation of this.

```js
const NativeDB = require('cooldb-native');
const EventEmitter = require('events');
const ROOT = process.cwd();

class MyCoolDB extends EventEmitter {
    constructor (conf, confName) {
        super();
        NativeDB.connect(conf, err => this.emit('connected', err));
        this.confName = confName;
    }

    getModel (name) {
        try {
            var schemaRaw = {...require(`${ROOT}/models/${this.confName}/${name}.js`)};
        } catch {
            this.emit('no-model', name);
            return;
        }

        // Mongoose-like model
        return NativeDB.getModelFromSchema(schemaRaw);
    }
}

module.exports = core => core.db(MyCoolDB, 'mycooldb');
```
