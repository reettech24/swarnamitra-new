const db = require('./db');

// Pick whitelisted fields from body; empty strings become null.
function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

async function upsertLoan(userId, data) {
  const [r] = await db.query('SELECT id FROM loans WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  const keys = Object.keys(data);
  if (r.length) {
    if (keys.length) {
      await db.query(`UPDATE loans SET ${keys.map((k) => k + ' = ?').join(', ')} WHERE id = ?`, [
        ...keys.map((k) => data[k]),
        r[0].id,
      ]);
    }
    return r[0].id;
  }
  const [ins] = await db.query(
    `INSERT INTO loans (user_id${keys.map((k) => ', ' + k).join('')}) VALUES (?${keys.map(() => ', ?').join('')})`,
    [userId, ...keys.map((k) => data[k])]
  );
  return ins.insertId;
}

async function setKyc(userId, step, status) {
  await db.query(
    `INSERT INTO kyc_verifications (user_id, step, status, verified_at)
     VALUES (?, ?, ?, IF(? = 'verified', NOW(), NULL))
     ON DUPLICATE KEY UPDATE status = VALUES(status), verified_at = VALUES(verified_at)`,
    [userId, step, status, status]
  );
}

async function notify(userId, message) {
  await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [userId, message]);
}

async function notifyStaff(message) {
  await db.query(
    `INSERT INTO notifications (user_id, message)
     SELECT u.id, ? FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.name IN ('admin', 'employee') AND u.is_active = 1`,
    [message]
  );
}

module.exports = { pick, upsertLoan, setKyc, notify, notifyStaff };
