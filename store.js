const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.data = {};
    try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {}
  }

  get(key) {
    if (key === 'botToken') {
      const enc = this.data.botTokenEnc;
      if (!enc) return this.data.botToken || null;
      try { return safeStorage.decryptString(Buffer.from(enc, 'base64')); } catch { return null; }
    }
    return this.data[key] !== undefined ? this.data[key] : null;
  }

  set(key, value) {
    if (key === 'botToken') {
      try {
        this.data.botTokenEnc = safeStorage.encryptString(value).toString('base64');
        delete this.data.botToken;
      } catch {
        this.data.botToken = value;
      }
    } else if (value === null || value === undefined) {
      delete this.data[key];
    } else {
      this.data[key] = value;
    }
    this.save();
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch {}
  }
}

module.exports = Store;