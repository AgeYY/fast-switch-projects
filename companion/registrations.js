'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

// One atomic file per workspace avoids lost updates from different window hosts.
// Explicit denial persists too, so Unregister overrides a previous bulk approval.
class Registrations {
    constructor(storage) { this.root = path.join(storage, 'registrations'); }
    file(key) { return path.join(this.root, crypto.createHash('sha256').update(key).digest('hex') + '.json'); }
    get(key) {
        let value;
        try { value = JSON.parse(fs.readFileSync(this.file(key), 'utf8')); }
        catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
        if (value.key !== key || typeof value.approved !== 'boolean') throw new Error('Invalid project registration record');
        return value.approved;
    }
    set(key, approved) {
        fs.mkdirSync(this.root, {recursive: true});
        const file = this.file(key), temporary = file + '.' + crypto.randomUUID() + '.tmp';
        try {
            fs.writeFileSync(temporary, JSON.stringify({key, approved}), {flag: 'wx'});
            fs.renameSync(temporary, file);
        } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    }
}
module.exports = { Registrations };
