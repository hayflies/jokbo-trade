const { getMariaPool } = require('../db/mariadb');

async function recordBidLog({ auctionId, bidderId, amount }) {
  const pool = getMariaPool();
  await pool.query(
    `INSERT INTO bid_logs (auction_id, bidder_id, amount) VALUES (?, ?, ?)`,
    [auctionId, bidderId, amount]
  );
}

async function listBidLogs(auctionId) {
  const pool = getMariaPool();
  const [rows] = await pool.query(
    `SELECT bid_logs.*, users.nickname FROM bid_logs
     JOIN users ON users.id = bid_logs.bidder_id
     WHERE auction_id = ?
     ORDER BY created_at DESC`,
    [auctionId]
  );
  return rows;
}

module.exports = { recordBidLog, listBidLogs };
