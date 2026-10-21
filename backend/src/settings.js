const db = require('./db');
const DEFAULTS = { processing_fee: '5000', upi_id: '', payee_name: 'Suvarna Mitra Finance' };

async function getSettings() {
  const [rows] = await db.query('SELECT k, v FROM settings');
  const out = { ...DEFAULTS };
  rows.forEach((r) => (out[r.k] = r.v));
  return out;
}

async function setSettings(obj) {
  for (const k of Object.keys(DEFAULTS)) {
    if (obj[k] !== undefined) {
      await db.query(
        'INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
        [k, String(obj[k])]
      );
    }
  }
}

module.exports = { getSettings, setSettings };
