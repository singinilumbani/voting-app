const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());



app.get('/', (req, res) => {
  res.json({ message: 'Voting API is alive' });
});

const positionsRouter = require('./src/routes/positions');
const votesRouter = require('./src/routes/votes');
const authRouter = require('./src/routes/auth');
const adminRouter = require('./src/routes/admin');

app.use('/api/positions', positionsRouter);
app.use('/api/vote', votesRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/setup-db-once', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const pool = require('./src/db');
  try {
    const sqlPath = path.join(__dirname, 'src', 'sql', 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);

    const check = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    res.json({ message: 'Schema executed', tables: check.rows.map(r => r.table_name) });
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.detail || null });
  }
});

app.get('/create-admin-once', async (req, res) => {
  const bcrypt = require('bcrypt');
  const pool = require('./src/db');
  try {
    const hashedPassword = await bcrypt.hash('yourRealPassword', 10);
    const result = await pool.query(
      'INSERT INTO admins (email, password) VALUES ($1, $2) RETURNING id, email',
      ['admin@example.com', hashedPassword]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});