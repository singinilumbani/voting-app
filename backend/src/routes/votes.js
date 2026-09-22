const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');

function ensureVoterToken(req, res, next) {
  let token = req.cookies.voter_token;

  if (!token) {
    token = crypto.randomUUID();
    res.cookie('voter_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 365
    });
  }

  req.voterToken = token;
  next();
}

router.use(ensureVoterToken);

router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT position_id, candidate_id FROM votes WHERE voter_token = $1',
      [req.voterToken]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vote status' });
  }
});

router.post('/', async (req, res) => {
  const { positionId, candidateId } = req.body;

  if (!positionId || !candidateId) {
    return res.status(400).json({ error: 'positionId and candidateId are required' });
  }

  try {
    const candidateResult = await pool.query(
      'SELECT * FROM candidates WHERE id = $1',
      [candidateId]
    );
    const candidate = candidateResult.rows[0];

    if (!candidate || candidate.position_id !== positionId) {
      return res.status(400).json({ error: 'Invalid candidate for this position' });
    }

    const voteResult = await pool.query(
      `INSERT INTO votes (voter_token, position_id, candidate_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.voterToken, positionId, candidateId]
    );

    res.status(201).json({ message: 'Vote recorded', vote: voteResult.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already voted for this position' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

module.exports = router;
