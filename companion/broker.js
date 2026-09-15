'use strict';
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
class Broker {
    constructor(storage, executable = path.join(__dirname, 'bin', 'FspWindows.exe')) {
        this.executable = executable;
        this.state = path.join(storage, 'windows.json');
        this.name = 'fsp-windows-' + crypto.createHash('sha256').update(storage.toLowerCase()).digest('hex').slice(0, 24);
        this.pipe = '\\\\.\\pipe\\' + this.name;
    }
    request(message, attempt = 0) {
        return new Promise((resolve, reject) => {
            const socket = net.createConnection(this.pipe);
            let data = '', connected = false;
            const timer = setTimeout(() => { socket.destroy(); reject(new Error('Windows helper timed out')); }, 5000);
            socket.on('connect', () => { connected = true; socket.write(JSON.stringify(message) + '\n'); });
            socket.on('data', chunk => {
                data += chunk;
                if (data.length > 131072) { socket.destroy(new Error('Oversized helper response')); return; }
                if (!data.includes('\n')) return;
                clearTimeout(timer); socket.destroy();
                try { const result = JSON.parse(data.split('\n')[0]); result.ok ? resolve(result) : reject(new Error(result.error)); }
                catch (error) { reject(error); }
            });
            socket.on('error', error => {
                clearTimeout(timer);
                // The serialized pipe server briefly recreates its listener. Retry
                // only before connecting, so a mutation can never run twice.
                if (!connected && attempt < 30 && ['ENOENT','EBUSY','ECONNREFUSED'].includes(error.code)) {
                    setTimeout(() => this.request(message, attempt + 1).then(resolve, reject), 10);
                } else reject(error);
            });
            socket.on('end', () => { if (!data.includes('\n')) { clearTimeout(timer); reject(new Error('Helper closed without a response')); } });
        });
    }
    async start() {
        try { return await this.request({op: 'status'}); }
        catch (error) { if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error; }
        const child = spawn(this.executable, ['serve', this.name, this.state], { detached: true, windowsHide: true, stdio: 'ignore' });
        let spawnError;
        child.on('error', error => { spawnError = error; }); child.unref();
        for (let n = 0; n < 30; n++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (spawnError) throw spawnError;
            try { return await this.request({op: 'status'}); } catch (error) {
                if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error;
            }
        }
        throw new Error('Windows helper did not start');
    }
    async recover() {
        try { await this.request({op: 'showAll'}); }
        catch {
            await new Promise((resolve, reject) => execFile(this.executable, ['recover', this.state],
                { windowsHide: true, timeout: 5000 }, error => error ? reject(error) : resolve()));
        }
    }
}
module.exports = { Broker };
