// Lead status automation:
//  account created -> Warm | documents uploaded -> Hot | processing fee paid -> Won (DB trigger)
//  no action for 30 days -> Cold (cron job) | loan rejected / cancelled -> Lost
const db = require('./db');

async function linkOrCreateLead(conn, { userId, name, mobile }) {
  const [r] = await conn.query(
    'SELECT id FROM leads WHERE contact = ? AND customer_id IS NULL ORDER BY id LIMIT 1',
    [mobile]
  );
  if (r.length) {
    await conn.query('UPDATE leads SET customer_id = ?, last_activity = NOW() WHERE id = ?', [userId, r[0].id]);
    return r[0].id;
  }
  const [ins] = await conn.query(
    "INSERT INTO leads (customer_id, name, contact, status) VALUES (?, ?, ?, 'warm')",
    [userId, name, mobile]
  );
  await conn.query(
    "INSERT INTO lead_status_history (lead_id, old_status, new_status, reason) VALUES (?, NULL, 'warm', 'account created')",
    [ins.insertId]
  );
  return ins.insertId;
}

async function setLeadStatus(leadId, newStatus, reason) {
  const [r] = await db.query('SELECT status FROM leads WHERE id = ?', [leadId]);
  if (!r.length || r[0].status === newStatus) return;
  await db.query('UPDATE leads SET status = ?, last_activity = NOW() WHERE id = ?', [newStatus, leadId]);
  await db.query(
    'INSERT INTO lead_status_history (lead_id, old_status, new_status, reason) VALUES (?, ?, ?, ?)',
    [leadId, r[0].status, newStatus, reason]
  );
}

// Record customer activity and optionally move the lead (never touches Won/Lost).
async function moveLead(userId, newStatus, reason, onlyFrom) {
  const [r] = await db.query('SELECT id, status FROM leads WHERE customer_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  if (!r.length) return;
  const l = r[0];
  await db.query('UPDATE leads SET last_activity = NOW() WHERE id = ?', [l.id]);
  if (newStatus && !['won', 'lost'].includes(l.status) && (!onlyFrom || onlyFrom.includes(l.status))) {
    await setLeadStatus(l.id, newStatus, reason);
  }
}

module.exports = { linkOrCreateLead, setLeadStatus, moveLead };
