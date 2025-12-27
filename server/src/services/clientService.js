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
        return this._getDB().prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
    }

    getClientById(id) {
        return this._getDB().prepare('SELECT * FROM clients WHERE id = ?').get(id);
    }

    createClient(client) {
        const { type, host, port, username, password } = client;
        const info = this._getDB().prepare(
            'INSERT INTO clients (type, host, port, username, password) VALUES (?, ?, ?, ?, ?)'
        ).run(type, host, port, username, password);
        return info.lastInsertRowid;
    }

    updateClient(id, client) {
        const { type, host, port, username, password } = client;
        return this._getDB().prepare(
            'UPDATE clients SET type = ?, host = ?, port = ?, username = ?, password = ? WHERE id = ?'
        ).run(type, host, port, username, password, id);
    }

    deleteClient(id) {
        return this._getDB().prepare('DELETE FROM clients WHERE id = ?').run(id);
    }
}

module.exports = new ClientService();
