const path = require('path');
const fs = require('fs');
const Auction = require('../models/mongo/Auction');
const { recordBidLog } = require('../models/bidLogModel');
const { broadcastBidUpdate } = require('./socketService');

async function listAuctions({ page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Auction.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Auction.countDocuments()
  ]);
  return {
    items,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

async function getAuctionById(id) {
  return Auction.findById(id);
}

async function createAuction({ title, description, startPrice, endTime, sellerId, sellerNickname, file }) {
  const auction = new Auction({
    title,
    description,
    sellerId,
    sellerNickname,
    startPrice,
    currentPrice: startPrice,
    endTime,
    filePath: file.path,
    fileOriginalName: file.originalname
  });
  await auction.save();
  broadcastBidUpdate(auction);
  return auction;
}

async function placeBid({ auctionId, bidderId, bidderNickname, amount }) {
  const auction = await Auction.findById(auctionId);
  if (!auction) {
    throw Object.assign(new Error('Auction not found'), { status: 404 });
  }
  if (auction.status === 'CLOSED') {
    throw Object.assign(new Error('Auction already closed'), { status: 400 });
  }

  const now = new Date();
  if (auction.endTime < now) {
    auction.status = 'CLOSED';
    await auction.save();
    throw Object.assign(new Error('Auction has ended'), { status: 400 });
  }

  if (amount <= auction.currentPrice) {
    throw Object.assign(new Error('Bid must be higher than current price'), { status: 400 });
  }

  auction.currentPrice = amount;
  auction.bids.push({ bidderId, bidderNickname, amount, createdAt: now });

  const oneMinute = 60 * 1000;
  if (auction.endTime.getTime() - now.getTime() <= oneMinute) {
    auction.endTime = new Date(now.getTime() + oneMinute);
  }

  await auction.save();
  await recordBidLog({ auctionId: auction.id, bidderId, amount });
  broadcastBidUpdate(auction);

  return auction;
}

async function closeExpiredAuctions() {
  const now = new Date();
  await Auction.updateMany({ endTime: { $lt: now }, status: 'OPEN' }, { status: 'CLOSED' });
}

async function deleteAuctionFile(filePath) {
  if (!filePath) return;
  const absolutePath = path.resolve(filePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

module.exports = {
  listAuctions,
  getAuctionById,
  createAuction,
  placeBid,
  closeExpiredAuctions,
  deleteAuctionFile
};
