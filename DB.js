const ROOT = process.cwd();
const mongoose = require('mongoose');
const {Schema} = mongoose;
const mongooseAI = require('mongoose-auto-increment');

class DB {
    constructor(conf, devMode = false) {
        !conf.port && (conf.port = 27017);
        const uri = `mongodb://${conf.user?`${conf.user}:${conf.pass}@`:''}${conf.host}:${conf.port}/${conf.name}`;
        this.conn = mongoose.createConnection(uri, {
            useCreateIndex: true,
            useNewUrlParser: true
        });
        mongooseAI.initialize(this.conn);

        return new Proxy(this, {
            get(obj, name) {
                if(name in obj) return obj[name];
                if(name in obj.conn.models) {
                    if(devMode) {
                        // Removing cached model in devMode
                        delete obj.conn.models[name];
                        delete require.cache[require.resolve(`${ROOT}/models/${name}.js`)];
                    }
                    else return obj.conn.models[name];
                }

                let schemaRaw = {...require(`${ROOT}/models/${name}.js`)};
                let schemaData = {
                    virtuals: schemaRaw.virtuals || {}
                };

                delete schemaRaw.virtuals;
                // Parsing auto-increment options
                switch(typeof schemaRaw.increment) {
                    case 'string':
                        schemaData.increment = {
                            model: name,
                            field: schemaRaw.increment
                        };
                        break;
                    case 'object':
                        schemaData.increment = {...schemaRaw.increment, ...{model: name}};
                        break;
                }
                delete schemaRaw.increment;

                const schema = new Schema(schemaRaw);
                // Parsing virtuals
                Object.keys(schemaData.virtuals).forEach(key => {
                    schema.virtual(key)
                        .get(schemaData.virtuals[key].get)
                        .set(schemaData.virtuals[key].set);
                });
                // Enabling auto-increment plugin if necessary
                schemaData.increment && schema.plugin(mongooseAI.plugin, schemaData.increment);
                return obj.conn.model(name, schema);
            }
        });
    }
}

module.exports = DB;