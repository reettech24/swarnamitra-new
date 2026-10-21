const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { auth, wrap } = require('../middleware');
const { linkOrCreateLead } = require('../leadflow');

const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '12h' });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, mobile: u.mobile, role: u.role, customer_code: u.customer_code });
const getUser = async (id) =>
  (await db.query('SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?', [id]))[0][0];

router.post('/register', wrap(async (req, res) => {
  const { name, mobile, password, confirm } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!name || !email || !mobile || !password) return res.status(400).json({ error: 'All fields are required' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (!/^[6-9]\d{9}$/.test(mobile)) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (password !== confirm) return res.status(400).json({ error: 'Passwords do not match' });

  const [dup] = await db.query('SELECT id FROM users WHERE email = ? OR mobile = ?', [email, mobile]);
  if (dup.length) return res.status(409).json({ error: 'An account with this email or mobile already exists' });

  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password, 10);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO users (id, role_id, name, email, mobile, password_hash)
       VALUES (?, (SELECT id FROM roles WHERE name = 'customer'), ?, ?, ?, ?)`,
      [id, name.trim(), email, mobile, hash]
    );
    await conn.query('INSERT INTO customer_profiles (user_id, contact_no) VALUES (?, ?)', [id, mobile]);
    await linkOrCreateLead(conn, { userId: id, name: name.trim(), mobile });
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  const u = await getUser(id);
  res.json({ token: sign(u), user: pub(u) });
}));

router.post('/login', wrap(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Enter your email/mobile and password' });
  const id = String(identifier).trim();
  const [rows] = await db.query(
    'SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? OR u.mobile = ?',
    [id.toLowerCase(), id]
  );
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'Invalid login details' });
  if (!u.is_active) return res.status(403).json({ error: 'This account is disabled' });
  res.json({ token: sign(u), user: pub(u) });
}));

router.get('/me', auth, wrap(async (req, res) => {
  const u = await getUser(req.user.id);
  if (!u) return res.status(401).json({ error: 'Account not found' });
  res.json({ user: pub(u) });
}));

router.post('/change-password', auth, wrap(async (req, res) => {
  const { current, password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const u = await getUser(req.user.id);
  if (!(await bcrypt.compare(current || '', u.password_hash))) return res.status(400).json({ error: 'Current password is wrong' });
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), u.id]);
  res.json({ ok: true });
}));

module.exports = router;
