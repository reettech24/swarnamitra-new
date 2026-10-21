require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

if (!process.env.JWT_SECRET || !/^[0-9a-f]{64}$/i.test(process.env.ENC_KEY || '')) {
  console.error('Set JWT_SECRET and a 64-hex-character ENC_KEY in .env (see .env.example)');
  process.exit(1);
}
fs.mkdirSync(process.env.UPLOAD_DIR || 'uploads', { recursive: true });

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }), require('./routes/auth'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/files', require('./routes/files'));

app.use((err, req, res, next) => {
  if (err.name === 'MulterError') return res.status(400).json({ error: err.message });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

require('./jobs').start();
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Suvarna Mitra API running on port ${port}`));
