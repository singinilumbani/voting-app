const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const upload = require('../middleware/upload');

router.use(requireAuth);

router.post('/positions', async (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO positions (title) VALUES ($1) RETURNING *',
      [title]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create position' });
  }
});

router.put('/positions/:id', async (req, res) => {
  const { title } = req.body;
  try {
    const result = await pool.query(
      'UPDATE positions SET title = $1 WHERE id = $2 RETURNING *',
      [title, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Position not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update position' });
  }
});

router.delete('/positions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM positions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Position deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

router.post('/candidates', upload.single('photo'), async (req, res) => {
  const { name, bio, positionId } = req.body;

  if (!name || !positionId || !req.file) {
    return res.status(400).json({ error: 'name, positionId, and photo are required' });
  }

  try {
    const photoUrl = `/uploads/${req.file.filename}`;

    const result = await pool.query(
      `INSERT INTO candidates (name, photo_url, bio, position_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, photoUrl, bio || null, positionId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create candidate' });
  }
});

router.delete('/candidates/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM candidates WHERE id = $1', [req.params.id]);
    res.json({ message: 'Candidate deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
});

router.get('/results', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id AS position_id,
        p.title AS position_title,
        c.id AS candidate_id,
        c.name AS candidate_name,
        c.photo_url,
        COUNT(v.id) AS vote_count
      FROM positions p
      LEFT JOIN candidates c ON c.position_id = p.id
      LEFT JOIN votes v ON v.candidate_id = c.id
      GROUP BY p.id, c.id
      ORDER BY p.title, vote_count DESC
    `);

    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.position_id]) {
        grouped[row.position_id] = {
          positionId: row.position_id,
          title: row.position_title,
          candidates: []
        };
      }
      grouped[row.position_id].candidates.push({
        candidateId: row.candidate_id,
        name: row.candidate_name,
        photoUrl: row.photo_url,
        voteCount: parseInt(row.vote_count, 10)
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

module.exports = router;
