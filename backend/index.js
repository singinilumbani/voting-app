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

app.use('/uploads', express.static('uploads'));

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
