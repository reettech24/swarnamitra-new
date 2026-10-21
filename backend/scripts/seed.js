// Creates the first admin account: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../src/db');

(async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_MOBILE, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_MOBILE || !ADMIN_PASSWORD) throw new Error('Set ADMIN_* values in .env');
  const [ex] = await db.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL.toLowerCase()]);
  if (ex.length) {
    console.log('Admin already exists:', ADMIN_EMAIL);
  } else {
    await db.query(
      "INSERT INTO users (id, role_id, name, email, mobile, password_hash, email_verified, mobile_verified) VALUES (?, (SELECT id FROM roles WHERE name = 'admin'), ?, ?, ?, ?, 1, 1)",
      [crypto.randomUUID(), ADMIN_NAME || 'Owner', ADMIN_EMAIL.toLowerCase(), ADMIN_MOBILE, await bcrypt.hash(ADMIN_PASSWORD, 10)]
    );
    console.log('Admin created:', ADMIN_EMAIL);
  }
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
