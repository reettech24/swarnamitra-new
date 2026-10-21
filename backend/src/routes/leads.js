const router = require('express').Router();
const db = require('../db');
const { auth, allow, wrap } = require('../middleware');
const { setLeadStatus } = require('../leadflow');
const { notifyStaff } = require('../util');

router.use(auth, allow('admin', 'employee', 'agent'));

const STATUSES = ['hot', 'warm', 'cold', 'lost', 'won'];

// Agents register leads; they show up in the admin lead list.
router.post('/', wrap(async (req, res) => {
  const { name, contact, loan_required, current_bank } = req.body;
  if (!name || !contact) return res.status(400).json({ error: 'Name and contact are required' });
  if (!/^[6-9]\d{9}$/.test(contact)) return res.status(400).json({ error: 'Enter a valid 10-digit contact number' });
  const [dup] = await db.query('SELECT id FROM leads WHERE contact = ? UNION SELECT id FROM users WHERE mobile = ?', [contact, contact]);
  if (dup.length) return res.status(409).json({ error: 'This contact is already registered' });
  const agentId = req.user.role === 'agent' ? req.user.id : null;
  const [ins] = await db.query(
    "INSERT INTO leads (agent_id, name, contact, loan_required, current_bank, status) VALUES (?, ?, ?, ?, ?, 'warm')",
    [agentId, name.trim(), contact, loan_required || null, current_bank || null]
  );
  await db.query("INSERT INTO lead_status_history (lead_id, old_status, new_status, reason) VALUES (?, NULL, 'warm', 'lead registered')", [ins.insertId]);
  await notifyStaff(`New lead registered: ${name.trim()} (${contact}).`);
  res.json({ id: ins.insertId });
}));

router.get('/', wrap(async (req, res) => {
  const { status, q } = req.query;
  const where = [];
  const params = [];
  if (req.user.role === 'agent') { where.push('l.agent_id = ?'); params.push(req.user.id); }
  if (STATUSES.includes(status)) { where.push('l.status = ?'); params.push(status); }
  if (q) {
    where.push('(l.name LIKE ? OR l.contact LIKE ? OR u.customer_code LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const [rows] = await db.query(
    `SELECT l.id, l.name, l.contact, l.status, l.loan_required, l.current_bank, l.created_at,
            a.name AS agent_name, u.id AS customer_user_id, u.customer_code, u.email,
            u.mobile_verified, u.email_verified, cp.cibil_score,
            ln.loan_status, ln.old_loan_amount, ln.old_roi, ln.new_loan_amount, ln.new_roi, ln.amount_required,
            (SELECT status FROM payments p WHERE p.user_id = u.id AND p.purpose = 'processing_fee' ORDER BY p.id DESC LIMIT 1) AS fee_status
     FROM leads l
     LEFT JOIN users u ON u.id = l.customer_id
     LEFT JOIN users a ON a.id = l.agent_id
     LEFT JOIN customer_profiles cp ON cp.user_id = u.id
     LEFT JOIN loans ln ON ln.id = (SELECT MAX(id) FROM loans WHERE user_id = u.id)
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY l.id DESC LIMIT 1000`,
    params
  );
  if (req.user.role === 'agent') {
    return res.json(rows.map(({ id, name, contact, status, loan_required, current_bank, created_at }) => ({ id, name, contact, status, loan_required, current_bank, created_at })));
  }
  res.json(rows);
}));

router.put('/:id/status', allow('admin', 'employee'), wrap(async (req, res) => {
  const { status, reason } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  await setLeadStatus(req.params.id, status, reason || `changed by ${req.user.name}`);
  res.json({ ok: true });
}));

module.exports = router;
