const bcrypt = require('bcrypt');
const pool = require('../db');

async function createAdmin() {
  const email = process.argv[2];
  const plainPassword = process.argv[3];

  if (!email || !plainPassword) {
    console.log('Usage: node src/scripts/createAdmin.js <email> <password>');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const result = await pool.query(
    'INSERT INTO admins (email, password) VALUES ($1, $2) RETURNING id, email',
    [email, hashedPassword]
  );

  console.log('Admin created:', result.rows[0]);
  process.exit(0);
}

createAdmin();