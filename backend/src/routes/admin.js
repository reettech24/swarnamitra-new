const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../db');
const { auth, allow, wrap, upload } = require('../middleware');
const { dec, mask } = require('../crypto');
const { pick, upsertLoan, setKyc, notify } = require('../util');
const { setLeadStatus } = require('../leadflow');
const { getSettings, setSettings } = require('../settings');

router.use(auth, allow('admin', 'employee'));
const adminOnly = allow('admin');
const CUSTOMER = "(SELECT id FROM roles WHERE name = 'customer')";
const num = (rows) => rows.map((r) => ({ label: String(r.label), value: Number(r.value) }));

/* ---------------- Dashboard ---------------- */
router.get('/dashboard', wrap(async (req, res) => {
  const { from, to } = req.query;
  const range = from && to ? ' AND disbursed_on BETWEEN ? AND ?' : '';
  const rp = from && to ? [from, to] : [];

  const [[{ customers }]] = await db.query(`SELECT COUNT(*) customers FROM users WHERE role_id = ${CUSTOMER}`);
  const [reg] = await db.query(`SELECT DATE_FORMAT(created_at, '%Y-%m') label, COUNT(*) value FROM users WHERE role_id = ${CUSTOMER} GROUP BY label ORDER BY label DESC LIMIT 12`);
  const [fees] = await db.query("SELECT DATE_FORMAT(paid_at, '%Y-%m') label, SUM(amount) value FROM payments WHERE status = 'paid' AND purpose = 'processing_fee' GROUP BY label ORDER BY label DESC LIMIT 12");
  const [leads] = await db.query('SELECT status label, COUNT(*) value FROM leads GROUP BY status');
  const [[tot]] = await db.query(`SELECT COALESCE(SUM(new_loan_amount), 0) total, COUNT(*) cnt FROM loans WHERE disbursed_on IS NOT NULL${range}`, rp);
  const [[feeTot]] = await db.query("SELECT COALESCE(SUM(amount), 0) total FROM payments WHERE status = 'paid' AND purpose = 'processing_fee'");
  const [[{ pending }]] = await db.query("SELECT COUNT(*) pending FROM payments WHERE status = 'pending' AND gateway_ref IS NOT NULL AND purpose = 'processing_fee'");
  const grp = async (expr) => num((await db.query(`SELECT ${expr} label, COALESCE(SUM(new_loan_amount), 0) value FROM loans WHERE disbursed_on IS NOT NULL${range} GROUP BY label ORDER BY label`, rp))[0]);

  res.json({
    customers, fees_total: Number(feeTot.total), fees_to_confirm: pending,
    registrations: num(reg).reverse(), fees: num(fees).reverse(), leads: num(leads),
    disbursed: {
      total: Number(tot.total), count: tot.cnt,
      month: await grp("DATE_FORMAT(disbursed_on, '%Y-%m')"),
      quarter: await grp("CONCAT(YEAR(disbursed_on), '-Q', QUARTER(disbursed_on))"),
      year: await grp('YEAR(disbursed_on)'),
    },
  });
}));

router.get('/notifications', wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, message, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 15', [req.user.id]);
  res.json(rows);
}));

/* ---------------- Customer detail ---------------- */
router.get('/customers/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const [[user]] = await db.query('SELECT id, customer_code, name, email, mobile, email_verified, mobile_verified, is_active, created_at FROM users WHERE id = ?', [id]);
  if (!user) return res.status(404).json({ error: 'Customer not found' });
  const [[p]] = await db.query('SELECT * FROM customer_profiles WHERE user_id = ?', [id]);
  const [kycRows] = await db.query('SELECT step, status FROM kyc_verifications WHERE user_id = ?', [id]);
  const kyc = {};
  kycRows.forEach((k) => (kyc[k.step] = k.status));
  const [[loan]] = await db.query('SELECT * FROM loans WHERE user_id = ? ORDER BY id DESC LIMIT 1', [id]);
  const [rejections] = await db.query('SELECT r.* FROM loan_rejections r JOIN loans l ON l.id = r.loan_id WHERE l.user_id = ? ORDER BY r.id DESC', [id]);
  const [docs] = await db.query('SELECT id, doc_type, mime_type, uploaded_at FROM documents WHERE user_id = ? ORDER BY id DESC', [id]);
  const [[payment]] = await db.query("SELECT id, amount, status, gateway_ref, paid_at FROM payments WHERE user_id = ? AND purpose = 'processing_fee' ORDER BY id DESC LIMIT 1", [id]);
  const [[lead]] = await db.query('SELECT id, status, agent_id, created_at FROM leads WHERE customer_id = ? ORDER BY id DESC LIMIT 1', [id]);
  const [history] = lead
    ? await db.query('SELECT old_status, new_status, reason, changed_at FROM lead_status_history WHERE lead_id = ? ORDER BY id DESC', [lead.id])
    : [[]];
  res.json({
    user,
    profile: p && { ...p, aadhaar_no: dec(p.aadhaar_no), pan_no: dec(p.pan_no) },
    kyc, loan: loan || null, rejections, documents: docs, payment: payment || null, lead: lead || null, history,
  });
}));

router.put('/customers/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const b = req.body;
  if (b.name !== undefined) await db.query('UPDATE users SET name = ? WHERE id = ?', [String(b.name).trim(), id]);
  for (const f of ['mobile_verified', 'email_verified']) {
    if (b[f] !== undefined) await db.query(`UPDATE users SET ${f} = ? WHERE id = ?`, [b[f] ? 1 : 0, id]);
  }
  const prof = pick(b, ['contact_no', 'current_address', 'city', 'state', 'pincode', 'aadhaar_name', 'cibil_score']);
  if (prof.cibil_score !== undefined && prof.cibil_score !== null) {
    prof.cibil_score = parseInt(prof.cibil_score, 10);
    if (!(prof.cibil_score >= 300 && prof.cibil_score <= 900)) return res.status(400).json({ error: 'CIBIL score must be between 300 and 900' });
  }
  const keys = Object.keys(prof);
  if (keys.length) await db.query(`UPDATE customer_profiles SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE user_id = ?`, [...keys.map((k) => prof[k]), id]);
  for (const step of ['aadhaar', 'pan', 'selfie']) {
    if (b[step + '_verified'] !== undefined) await setKyc(id, step, b[step + '_verified'] ? 'verified' : 'pending');
  }
  res.json({ ok: true });
}));

const LOAN_FIELDS = ['old_bank', 'old_loan_amount', 'old_roi', 'loan_start_date', 'loan_closure_date', 'closure_amount', 'new_bank', 'amount_required', 'new_loan_amount', 'new_roi', 'transfer_date', 'loan_status', 'disbursed_on'];
router.put('/customers/:id/loan', wrap(async (req, res) => {
  const data = pick(req.body, LOAN_FIELDS);
  if (data.loan_status && !['in_process', 'sanctioned', 'rejected'].includes(data.loan_status)) return res.status(400).json({ error: 'Invalid loan status' });
  await upsertLoan(req.params.id, data);
  if (data.loan_status) await notify(req.params.id, `Your loan status is now: ${data.loan_status.replace('_', ' ')}.`);
  res.json({ ok: true });
}));

router.post('/customers/:id/rejections', wrap(async (req, res) => {
  const { bank_name, processing_date, loan_amount, concerned_person, reason } = req.body;
  if (!bank_name) return res.status(400).json({ error: 'Bank name is required' });
  const loanId = await upsertLoan(req.params.id, { loan_status: 'rejected' });
  await db.query('INSERT INTO loan_rejections (loan_id, bank_name, processing_date, loan_amount, concerned_person, reason) VALUES (?, ?, ?, ?, ?, ?)',
    [loanId, bank_name, processing_date || null, loan_amount || null, concerned_person || null, reason || null]);
  const [[lead]] = await db.query('SELECT id FROM leads WHERE customer_id = ? ORDER BY id DESC LIMIT 1', [req.params.id]);
  if (lead) await setLeadStatus(lead.id, 'lost', `loan rejected by ${bank_name}`);
  res.json({ ok: true });
}));

router.put('/customers/:id/fee', wrap(async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'paid', 'failed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const [[pay]] = await db.query("SELECT id FROM payments WHERE user_id = ? AND purpose = 'processing_fee' ORDER BY id DESC LIMIT 1", [req.params.id]);
  if (pay) {
    await db.query('UPDATE payments SET status = ?, paid_at = IF(? = \'paid\', NOW(), NULL) WHERE id = ?', [status, status, pay.id]);
  } else {
    const s = await getSettings();
    await db.query("INSERT INTO payments (user_id, amount, purpose, status) VALUES (?, ?, 'processing_fee', 'pending')", [req.params.id, s.processing_fee]);
    if (status !== 'pending') {
      await db.query("UPDATE payments SET status = ?, paid_at = IF(? = 'paid', NOW(), NULL) WHERE user_id = ? AND purpose = 'processing_fee'", [status, status, req.params.id]);
    }
  }
  if (status === 'paid') await notify(req.params.id, 'Your processing fee payment has been received. Thank you!');
  res.json({ ok: true });
}));

/* Documents: staff upload signed agreement / NOC etc. for a customer */
router.post('/customers/:id/documents', upload.single('file'), wrap(async (req, res) => {
  const type = req.body.doc_type;
  if (!req.file) return res.status(400).json({ error: 'Choose a file' });
  if (!['signed_agreement', 'noc', 'other'].includes(type)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Invalid document type' });
  }
  await db.query('INSERT INTO documents (user_id, doc_type, file_url, mime_type) VALUES (?, ?, ?, ?)', [req.params.id, type, req.file.filename, req.file.mimetype]);
  await notify(req.params.id, `A new document was added to your account (${type.replace('_', ' ')}).`);
  res.json({ ok: true });
}));

router.delete('/documents/:id', wrap(async (req, res) => {
  const [r] = await db.query('SELECT file_url FROM documents WHERE id = ?', [req.params.id]);
  if (!r.length) return res.status(404).json({ error: 'Not found' });
  await db.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
  fs.unlink(path.resolve(process.env.UPLOAD_DIR || 'uploads', path.basename(r[0].file_url)), () => {});
  res.json({ ok: true });
}));

/* ---------------- Reports ---------------- */
const INTERVAL = { weekly: '7 DAY', monthly: '1 MONTH', quarterly: '3 MONTH', half: '6 MONTH', annual: '12 MONTH' };

async function buildReport(type, period) {
  const since = (col) => (INTERVAL[period] ? ` AND ${col} >= DATE_SUB(NOW(), INTERVAL ${INTERVAL[period]})` : '');
  if (type === 'fees') {
    const [rows] = await db.query(
      `SELECT u.customer_code, u.name, u.mobile, p.amount, p.gateway_ref AS reference, p.paid_at
       FROM payments p JOIN users u ON u.id = p.user_id
       WHERE p.status = 'paid' AND p.purpose = 'processing_fee'${since('p.paid_at')} ORDER BY p.paid_at DESC`);
    return {
      cols: [['customer_code', 'Customer ID'], ['name', 'Name'], ['mobile', 'Mobile'], ['amount', 'Amount'], ['reference', 'Reference'], ['paid_at', 'Paid On']],
      rows, numeric: ['amount'],
    };
  }
  if (type === 'leads') {
    const [rows] = await db.query(
      `SELECT l.id, l.name, l.contact, l.loan_required, l.current_bank, l.status, a.name AS agent, l.created_at
       FROM leads l LEFT JOIN users a ON a.id = l.agent_id WHERE 1 = 1${since('l.created_at')} ORDER BY l.id DESC`);
    return {
      cols: [['id', 'Lead #'], ['name', 'Name'], ['contact', 'Contact'], ['loan_required', 'Loan Required'], ['current_bank', 'Current Bank'], ['status', 'Status'], ['agent', 'Agent'], ['created_at', 'Created']],
      rows, numeric: ['loan_required'],
    };
  }
  const [rows] = await db.query(
    `SELECT u.customer_code, u.name, u.email, u.mobile, u.mobile_verified, u.email_verified, cp.city, cp.state, cp.cibil_score,
            cp.aadhaar_no, cp.pan_no, ln.old_bank, ln.old_loan_amount, ln.old_roi, ln.new_bank, ln.new_loan_amount, ln.new_roi, ln.loan_status,
            (SELECT status FROM payments p WHERE p.user_id = u.id AND p.purpose = 'processing_fee' ORDER BY p.id DESC LIMIT 1) AS fee_status,
            (SELECT status FROM leads l WHERE l.customer_id = u.id ORDER BY l.id DESC LIMIT 1) AS lead_status, u.created_at
     FROM users u LEFT JOIN customer_profiles cp ON cp.user_id = u.id
     LEFT JOIN loans ln ON ln.id = (SELECT MAX(id) FROM loans WHERE user_id = u.id)
     WHERE u.role_id = ${CUSTOMER}${since('u.created_at')} ORDER BY u.created_at DESC`);
  rows.forEach((r) => {
    r.aadhaar = mask(dec(r.aadhaar_no));
    r.pan = mask(dec(r.pan_no));
    r.mobile_verified = r.mobile_verified ? 'Yes' : 'No';
    r.email_verified = r.email_verified ? 'Yes' : 'No';
    delete r.aadhaar_no; delete r.pan_no;
  });
  return {
    cols: [['customer_code', 'Customer ID'], ['name', 'Name'], ['email', 'Email'], ['mobile', 'Mobile'], ['mobile_verified', 'Mobile Verified'], ['email_verified', 'Email Verified'],
      ['city', 'City'], ['state', 'State'], ['aadhaar', 'Aadhaar'], ['pan', 'PAN'], ['cibil_score', 'CIBIL'], ['old_bank', 'Old Bank'], ['old_loan_amount', 'Old Loan Amount'],
      ['old_roi', 'Old ROI'], ['new_bank', 'New Bank'], ['new_loan_amount', 'New Loan Amount'], ['new_roi', 'New ROI'], ['loan_status', 'Loan Status'],
      ['fee_status', 'Processing Fee'], ['lead_status', 'Lead Status'], ['created_at', 'Registered']],
    rows, numeric: ['old_loan_amount', 'new_loan_amount', 'old_roi', 'new_roi'],
  };
}

router.get('/reports/:type', wrap(async (req, res) => {
  const { type } = req.params;
  if (!['fees', 'customers', 'leads'].includes(type)) return res.status(404).json({ error: 'Unknown report' });
  const { cols, rows, numeric } = await buildReport(type, req.query.period);
  if (req.query.format !== 'xlsx') return res.json({ columns: cols.map(([key, header]) => ({ key, header })), rows });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(type);
  ws.columns = cols.map(([key, header]) => ({ header, key, width: Math.max(14, header.length + 4) }));
  rows.forEach((r) => {
    numeric.forEach((k) => { if (r[k] !== null && r[k] !== undefined) r[k] = Number(r[k]); });
    ws.addRow(r);
  });
  ws.getRow(1).font = { bold: true };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
  await wb.xlsx.write(res);
  res.end();
}));

/* ---------------- Settings (admin edits, staff read) ---------------- */
router.get('/settings', wrap(async (req, res) => res.json(await getSettings())));
router.put('/settings', adminOnly, wrap(async (req, res) => {
  const fee = Number(req.body.processing_fee);
  if (req.body.processing_fee !== undefined && !(fee >= 0)) return res.status(400).json({ error: 'Invalid fee amount' });
  await setSettings(req.body);
  res.json(await getSettings());
}));

/* ---------------- Staff & agent accounts (admin only) ---------------- */
router.get('/users', adminOnly, wrap(async (req, res) => {
  const [rows] = await db.query("SELECT u.id, u.name, u.email, u.mobile, u.is_active, r.name AS role, u.created_at FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('admin', 'employee', 'agent') ORDER BY u.created_at DESC");
  res.json(rows);
}));

router.post('/users', adminOnly, wrap(async (req, res) => {
  const { name, mobile, password, role } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!['admin', 'employee', 'agent'].includes(role)) return res.status(400).json({ error: 'Role must be admin, employee or agent' });
  if (!name || !email || !/^[6-9]\d{9}$/.test(mobile || '') || !password || password.length < 8) return res.status(400).json({ error: 'Name, email, 10-digit mobile and a password of 8+ characters are required' });
  const [dup] = await db.query('SELECT id FROM users WHERE email = ? OR mobile = ?', [email, mobile]);
  if (dup.length) return res.status(409).json({ error: 'Email or mobile already in use' });
  await db.query('INSERT INTO users (id, role_id, name, email, mobile, password_hash, email_verified, mobile_verified) VALUES (?, (SELECT id FROM roles WHERE name = ?), ?, ?, ?, ?, 1, 1)',
    [crypto.randomUUID(), role, name.trim(), email, mobile, await bcrypt.hash(password, 10)]);
  res.json({ ok: true });
}));

router.put('/users/:id', adminOnly, wrap(async (req, res) => {
  const { is_active, password, role } = req.body;
  if (req.params.id === req.user.id && (is_active === false || (role && role !== 'admin'))) return res.status(400).json({ error: 'You cannot disable or demote your own account' });
  if (is_active !== undefined) await db.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
  if (role && ['admin', 'employee', 'agent'].includes(role)) await db.query('UPDATE users SET role_id = (SELECT id FROM roles WHERE name = ?) WHERE id = ?', [role, req.params.id]);
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), req.params.id]);
  }
  res.json({ ok: true });
}));

module.exports = router;
