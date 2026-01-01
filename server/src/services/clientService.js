const { getDB } = require('../db');

class ClientService {
    constructor() {
        this.db = null;
    }

    _getDB() {
        if (!this.db) {
            this.db = getDB();
        }
        return this.db;
    }

    getAllClients() {
        return this._getDB().prepare('SELECT * FROM clients ORDER BY is_default DESC, created_at DESC').all();
    }

    getDefaultClient() {
        return this._getDB().prepare('SELECT * FROM clients WHERE is_default = 1').get();
    }

    getClientById(id) {
        return this._getDB().prepare('SELECT * FROM clients WHERE id = ?').get(id);
    }

    createClient(client) {
        const { name, type, host, port, username, password, is_default } = client;

        const db = this._getDB();
        const info = db.transaction(() => {
            if (is_default) {
                db.prepare('UPDATE clients SET is_default = 0').run();
            }
            return db.prepare(
                'INSERT INTO clients (name, type, host, port, username, password, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(name, type, host, port, username, password, is_default ? 1 : 0);
        })();

        return info.lastInsertRowid;
    }

    updateClient(id, client) {
        const { name, type, host, port, username, password, is_default } = client;

        const db = this._getDB();
        db.transaction(() => {
            if (is_default) {
                db.prepare('UPDATE clients SET is_default = 0').run();
            }
            db.prepare(
                'UPDATE clients SET name = ?, type = ?, host = ?, port = ?, username = ?, password = ?, is_default = ? WHERE id = ?'
            ).run(name, type, host, port, username, password, is_default ? 1 : 0, id);
        })();
    }

    deleteClient(id) {
        return this._getDB().prepare('DELETE FROM clients WHERE id = ?').run(id);
    }
}

module.exports = new ClientService();
