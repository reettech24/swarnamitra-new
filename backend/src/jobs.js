const cron = require('node-cron');
const db = require('./db');

async function markColdLeads() {
  const where = "status IN ('warm','hot') AND last_activity < DATE_SUB(NOW(), INTERVAL 30 DAY)";
  await db.query(
    `INSERT INTO lead_status_history (lead_id, old_status, new_status, reason)
     SELECT id, status, 'cold', 'no action for 1 month' FROM leads WHERE ${where}`
  );
  const [r] = await db.query(`UPDATE leads SET status = 'cold' WHERE ${where}`);
  if (r.affectedRows) console.log(`Marked ${r.affectedRows} lead(s) cold`);
}

exports.start = () => {
  cron.schedule('0 2 * * *', () => markColdLeads().catch(console.error));
};
exports.markColdLeads = markColdLeads;
