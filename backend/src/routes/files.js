const router = require('express').Router();
const path = require('path');
const db = require('../db');
const { auth, wrap } = require('../middleware');

// Authenticated download: customers can only open their own files; agents have no access.
router.get('/:id', auth, wrap(async (req, res) => {
  const [r] = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  const d = r[0];
  if (!d) return res.status(404).json({ error: 'File not found' });
  if (req.user.role === 'agent') return res.status(403).json({ error: 'Not allowed' });
  if (req.user.role === 'customer' && d.user_id !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  const file = path.resolve(process.env.UPLOAD_DIR || 'uploads', path.basename(d.file_url));
  res.download(file, `${d.doc_type}-${d.id}${path.extname(file)}`);
}));

module.exports = router;
