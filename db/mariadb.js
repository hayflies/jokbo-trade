const mysql = require('mysql2/promise');

let pool;

async function ensureDatabaseExists(config, database) {
  const connection = await mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await connection.end();
}

async function initMaria() {
  if (pool) {
    return pool;
  }

  const config = {
    host: process.env.MARIADB_HOST || 'localhost',
    user: process.env.MARIADB_USER || 'root',
    password: process.env.MARIADB_PASSWORD || '3203',
    database: process.env.MARIADB_DATABASE || '202010832',
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true
  };

  await ensureDatabaseExists(config, config.database);

  pool = mysql.createPool(config);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      real_name VARCHAR(255) NOT NULL,
      student_id VARCHAR(50) NOT NULL,
      nickname VARCHAR(255) UNIQUE NOT NULL,
      reputation_score DECIMAL(5,2) DEFAULT 5.00,
      reputation_count INT DEFAULT 0,
      is_admin TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reputation_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reviewer_id INT NOT NULL,
      target_id INT NOT NULL,
      score INT NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_review (reviewer_id, target_id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bid_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      auction_id VARCHAR(255) NOT NULL,
      bidder_id INT NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bidder_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [process.env.ADMIN_EMAIL || 'admin@example.com']);
  if (!rows.length) {
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin!234', 10);
    const nickname = `관리자-${Math.random().toString(36).substring(2, 8)}`;
    await pool.query(
      `INSERT INTO users (email, password_hash, real_name, student_id, nickname, is_admin) VALUES (?, ?, ?, ?, ?, 1)`,
      [process.env.ADMIN_EMAIL || 'admin@example.com', passwordHash, 'Super Admin', '202010832', nickname]
    );
  }

  return pool;
}

function getMariaPool() {
  if (!pool) {
    throw new Error('MariaDB has not been initialized. Call initMaria() first.');
  }
  return pool;
}

module.exports = { initMaria, getMariaPool };
