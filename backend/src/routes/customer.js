const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { auth, allow, wrap, upload } = require('../middleware');
const { enc, dec, mask } = require('../crypto');
const { pick, upsertLoan, setKyc, notifyStaff } = require('../util');
const { moveLead } = require('../leadflow');
const { getSettings } = require('../settings');

router.use(auth, allow('customer'));

const LOAN_FIELDS = ['old_bank', 'old_loan_amount', 'old_roi', 'loan_start_date', 'loan_closure_date', 'closure_amount', 'new_bank', 'amount_required'];
const DOC_TYPES = ['aadhaar', 'pan', 'cibil_report', 'loan_receipt', 'selfie', 'other'];

router.get('/overview', wrap(async (req, res) => {
  const uid = req.user.id;
  const [[user]] = await db.query('SELECT id, customer_code, name, email, mobile, email_verified, mobile_verified FROM users WHERE id = ?', [uid]);
  const [[p]] = await db.query('SELECT * FROM customer_profiles WHERE user_id = ?', [uid]);
  const [kycRows] = await db.query('SELECT step, status FROM kyc_verifications WHERE user_id = ?', [uid]);
  const kyc = {};
  kycRows.forEach((k) => (kyc[k.step] = k.status));
  const [docs] = await db.query('SELECT id, doc_type, mime_type, uploaded_at FROM documents WHERE user_id = ? ORDER BY id DESC', [uid]);
  const [[loan]] = await db.query('SELECT * FROM loans WHERE user_id = ? ORDER BY id DESC LIMIT 1', [uid]);
  const [[payment]] = await db.query("SELECT id, amount, status, gateway_ref, paid_at FROM payments WHERE user_id = ? AND purpose = 'processing_fee' ORDER BY id DESC LIMIT 1", [uid]);
  const [[lead]] = await db.query('SELECT status FROM leads WHERE customer_id = ? ORDER BY id DESC LIMIT 1', [uid]);
  const [notes] = await db.query('SELECT id, message, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 5', [uid]);
  const s = await getSettings();
  const aadhaar = dec(p?.aadhaar_no);
  const pan = dec(p?.pan_no);
  res.json({
    user,
    profile: {
      contact_no: p?.contact_no, current_address: p?.current_address, city: p?.city, state: p?.state, pincode: p?.pincode,
      aadhaar_masked: mask(aadhaar), pan_masked: mask(pan), aadhaar_name: p?.aadhaar_name,
    },
    kyc, documents: docs, loan: loan || null, payment: payment || null, application_status: lead?.status || null,
    notifications: notes,
    fee: { amount: s.processing_fee, upi_id: s.upi_id, payee_name: s.payee_name },
  });
}));

router.put('/profile', wrap(async (req, res) => {
  const uid = req.user.id;
  const { contact_no, current_address, city, state, pincode } = req.body;
  const aadhaar = (req.body.aadhaar_no || '').replace(/\s/g, '');
  const pan = (req.body.pan_no || '').toUpperCase().trim();
  if (aadhaar && !/^\d{12}$/.test(aadhaar)) return res.status(400).json({ error: 'Aadhaar number must be 12 digits' });
  if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return res.status(400).json({ error: 'Enter a valid PAN (e.g. ABCDE1234F)' });

  const [[cur]] = await db.query('SELECT aadhaar_no, pan_no FROM customer_profiles WHERE user_id = ?', [uid]);
  await db.query(
    `UPDATE customer_profiles SET contact_no = COALESCE(?, contact_no), current_address = COALESCE(?, current_address),
     city = COALESCE(?, city), state = COALESCE(?, state), pincode = COALESCE(?, pincode),
     aadhaar_no = COALESCE(?, aadhaar_no), pan_no = COALESCE(?, pan_no) WHERE user_id = ?`,
    [contact_no || null, current_address || null, city || null, state || null, pincode || null,
     aadhaar ? enc(aadhaar) : null, pan ? enc(pan) : null, uid]
  );
  if (aadhaar && aadhaar !== dec(cur?.aadhaar_no)) await setKyc(uid, 'aadhaar', 'pending');
  if (pan && pan !== dec(cur?.pan_no)) await setKyc(uid, 'pan', 'pending');
  await moveLead(uid);
  res.json({ ok: true });
}));

router.put('/loan', wrap(async (req, res) => {
  await upsertLoan(req.user.id, pick(req.body, LOAN_FIELDS));
  await moveLead(req.user.id);
  res.json({ ok: true });
}));

router.post('/documents', upload.single('file'), wrap(async (req, res) => {
  const type = req.body.doc_type;
  if (!req.file) return res.status(400).json({ error: 'Choose a file to upload' });
  if (!DOC_TYPES.includes(type)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Invalid document type' });
  }
  await db.query('INSERT INTO documents (user_id, doc_type, file_url, mime_type) VALUES (?, ?, ?, ?)', [req.user.id, type, req.file.filename, req.file.mimetype]);
  if (type === 'selfie') await setKyc(req.user.id, 'selfie', 'pending');
  await moveLead(req.user.id, 'hot', 'documents uploaded', ['warm', 'cold']);
  res.json({ ok: true });
}));

router.delete('/documents/:id', wrap(async (req, res) => {
  const [r] = await db.query('SELECT * FROM documents WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!r.length) return res.status(404).json({ error: 'Not found' });
  if (['signed_agreement', 'noc'].includes(r[0].doc_type)) return res.status(403).json({ error: 'This document cannot be deleted' });
  await db.query('DELETE FROM documents WHERE id = ?', [r[0].id]);
  fs.unlink(path.resolve(process.env.UPLOAD_DIR || 'uploads', path.basename(r[0].file_url)), () => {});
  res.json({ ok: true });
}));

// Customer pays via the UPI QR and submits the transaction reference; staff confirm the payment.
router.post('/fee', wrap(async (req, res) => {
  const reference = String(req.body.reference || '').trim();
  if (reference.length < 6) return res.status(400).json({ error: 'Enter the payment reference / UTR number' });
  const [[pay]] = await db.query("SELECT id, status FROM payments WHERE user_id = ? AND purpose = 'processing_fee' ORDER BY id DESC LIMIT 1", [req.user.id]);
  if (pay?.status === 'paid') return res.status(400).json({ error: 'Processing fee is already paid' });
  if (pay) {
    await db.query("UPDATE payments SET gateway_ref = ?, status = 'pending' WHERE id = ?", [reference, pay.id]);
  } else {
    const s = await getSettings();
    await db.query("INSERT INTO payments (user_id, amount, purpose, status, gateway_ref) VALUES (?, ?, 'processing_fee', 'pending', ?)", [req.user.id, s.processing_fee, reference]);
  }
  await moveLead(req.user.id);
  await notifyStaff(`${req.user.name} submitted a processing fee payment reference (${reference}).`);
  res.json({ ok: true });
}));

router.post('/submit', wrap(async (req, res) => {
  const uid = req.user.id;
  const [[p]] = await db.query('SELECT aadhaar_no, pan_no FROM customer_profiles WHERE user_id = ?', [uid]);
  const [[loan]] = await db.query('SELECT id, amount_required FROM loans WHERE user_id = ? ORDER BY id DESC LIMIT 1', [uid]);
  const [[{ n }]] = await db.query('SELECT COUNT(*) n FROM documents WHERE user_id = ?', [uid]);
  if (!p?.aadhaar_no || !p?.pan_no) return res.status(400).json({ error: 'Add your Aadhaar and PAN details first' });
  if (!loan?.amount_required) return res.status(400).json({ error: 'Add your loan details first' });
  if (!n) return res.status(400).json({ error: 'Upload at least one document' });
  await db.query('UPDATE loans SET submitted_at = NOW() WHERE id = ?', [loan.id]);
  await moveLead(uid);
  await notifyStaff(`New application submitted by ${req.user.name}.`);
  res.json({ ok: true });
}));

module.exports = router;
