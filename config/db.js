const mysql = require('mysql2/promise');

// UPDATE these values to match your MySQL setup
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Joshi@1234',
  database: 'counseling',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
