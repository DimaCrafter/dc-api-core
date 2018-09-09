const mongoose = require('mongoose');
const {Schema} = mongoose;

class DB {
    constructor(conf) {
        !conf.port && (conf.port = 27017);
        this.conn = mongoose.connect(`mongodb://${conf.user?`${conf.user}:${conf.pass}@`:''}${conf.host}:${conf.port}/${conf.name}`, {
            useNewUrlParser: true
        }).then(conn => {
            console.log(`[DB] Connected to ${conf.name} at ${conf.host}${conf.user?'@'+conf.user:''}`);
            this.conn = conn;
        }).catch(err => {
            console.log('[DB]', err.name + ":", err.message);
            process.exit();
        });
        return new Proxy(this, {
            get(obj, name) {
                if(name == '__this') return obj;
                if(name in obj.conn.models) return obj.conn.models[name];
                let schema = require(`../../models/${name}.js`);
                return mongoose.model(name, new Schema(schema));
            }
        });
    }
}

module.exports = DB;