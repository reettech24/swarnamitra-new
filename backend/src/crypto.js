// AES-256-GCM encryption for Aadhaar / PAN numbers stored in the database.
const crypto = require('crypto');
const key = () => Buffer.from(process.env.ENC_KEY, 'hex');

function enc(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('hex')).join(':');
}

function dec(s) {
  if (!s) return null;
  try {
    const [iv, tag, data] = s.split(':').map((h) => Buffer.from(h, 'hex'));
    const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

const mask = (v) => (v ? 'XXXXXXXX' + String(v).slice(-4) : null);

module.exports = { enc, dec, mask };
