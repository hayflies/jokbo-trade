const { getMariaPool } = require('../db/mariadb');

async function generateUniqueNickname() {
  const pool = getMariaPool();
  let unique = false;
  let nickname;
  while (!unique) {
    nickname = `익명(${Math.random().toString(36).substring(2, 8)})`;
    const [rows] = await pool.query('SELECT id FROM users WHERE nickname = ?', [nickname]);
    if (!rows.length) {
      unique = true;
    }
  }
  return nickname;
}

async function createUser({ email, passwordHash, realName, studentId }) {
  const pool = getMariaPool();
  const nickname = await generateUniqueNickname();
  const [result] = await pool.query(
    `INSERT INTO users (email, password_hash, real_name, student_id, nickname) VALUES (?, ?, ?, ?, ?)`,
    [email, passwordHash, realName, studentId, nickname]
  );
  return { id: result.insertId, email, realName, studentId, nickname };
}

async function findUserByEmail(email) {
  const pool = getMariaPool();
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

async function findUserById(id) {
  const pool = getMariaPool();
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0];
}

async function recordReputation({ reviewerId, targetId, auctionId, score, comment }) {
  const pool = getMariaPool();
  try {
    await pool.query(
      `INSERT INTO reputation_reviews (reviewer_id, target_id, auction_id, score, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [reviewerId, targetId, auctionId, score, comment]
    );
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('이미 평가를 등록하셨습니다.');
      duplicateError.code = 'REVIEW_EXISTS';
      throw duplicateError;
    }
    throw error;
  }

  const [summary] = await pool.query(
    `SELECT AVG(score) AS avgScore, COUNT(*) AS ratingCount FROM reputation_reviews WHERE target_id = ?`,
    [targetId]
  );

  const avgScoreRaw = summary[0].avgScore;
  let avgScore = 0;
  if (avgScoreRaw !== null && avgScoreRaw !== undefined) {
    const numericAvg = Number(avgScoreRaw);
    avgScore = Number.isFinite(numericAvg) ? numericAvg : 0;
  }
  const ratingCount = summary[0].ratingCount || 0;

  await pool.query(
    `UPDATE users SET reputation_score = ?, reputation_count = ? WHERE id = ?`,
    [avgScore.toFixed(2), ratingCount, targetId]
  );
}

async function listUsers({ page = 1, limit = 20 }) {
  const pool = getMariaPool();
  const offset = (page - 1) * limit;
  const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM users');
  return { users: rows, total };
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  recordReputation,
  listUsers
};
