const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const positionsResult = await pool.query('SELECT * FROM positions ORDER BY created_at DESC');
    const positions = positionsResult.rows;

    const candidatesResult = await pool.query('SELECT * FROM candidates');
    const candidates = candidatesResult.rows;

    const result = positions.map(position => ({
      ...position,
      candidates: candidates.filter(c => c.position_id === position.id)
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

module.exports = router;
