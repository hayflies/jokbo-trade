const path = require('path');
const fs = require('fs');
const Auction = require('../models/mongo/Auction');
const { recordBidLog } = require('../models/bidLogModel');
const { broadcastBidUpdate } = require('./socketService');

function buildSort(status) {
  if (status === 'CLOSED') {
    return { closedAt: -1, endTime: -1 };
  }
  return { endTime: 1, createdAt: -1 };
}

async function listAuctions({ page = 1, limit = 20, status, sellerId }) {
  const skip = (page - 1) * limit;
  const query = {};
  if (status) {
    query.status = status;
  }
  if (typeof sellerId !== 'undefined') {
    query.sellerId = sellerId;
  }
  const [items, total] = await Promise.all([
    Auction.find(query).sort(buildSort(status)).skip(skip).limit(limit),
    Auction.countDocuments(query)
  ]);
  return {
    items,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

function determineWinner(auction) {
  if (!auction.bids.length) {
    auction.winnerId = null;
    auction.winnerNickname = null;
    auction.winningBidAmount = null;
    return;
  }
  const highestBid = auction.bids.reduce((max, bid) => {
    if (!max || bid.amount > max.amount) {
      return bid;
    }
    return max;
  }, null);
  auction.winnerId = highestBid.bidderId;
  auction.winnerNickname = highestBid.bidderNickname;
  auction.winningBidAmount = highestBid.amount;
}

async function finalizeAuction(auction) {
  if (!auction || auction.status === 'CLOSED') {
    return auction;
  }
  determineWinner(auction);
  auction.status = 'CLOSED';
  auction.closedAt = new Date();
  await auction.save();
  broadcastBidUpdate(auction);
  return auction;
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

  if (auction.sellerId === bidderId) {
    throw Object.assign(new Error('자신의 경매에는 입찰할 수 없습니다.'), { status: 400 });
  }

  const now = new Date();
  if (auction.endTime < now) {
    await finalizeAuction(auction);
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
  const expired = await Auction.find({ endTime: { $lt: now }, status: 'OPEN' });
  await Promise.all(expired.map((auction) => finalizeAuction(auction)));
}

async function listUserAuctions(userId) {
  const [open, closed] = await Promise.all([
    Auction.find({ sellerId: userId, status: 'OPEN' }).sort(buildSort('OPEN')),
    Auction.find({ sellerId: userId, status: 'CLOSED' }).sort(buildSort('CLOSED'))
  ]);
  return { open: open.map((auction) => auction.toObject()), closed: closed.map((auction) => auction.toObject()) };
}

async function listUserNotifications(userId) {
  const auctions = await Auction.find({
    status: 'CLOSED',
    $or: [{ sellerId: userId }, { winnerId: userId }]
  }).sort(buildSort('CLOSED'));

  return auctions.map((auctionDoc) => {
    const auction = auctionDoc.toObject();
    const isSeller = auction.sellerId === userId;
    const isWinner = auction.winnerId === userId;
    const hasWinner = !!auction.winnerId;
    let message;
    if (isSeller) {
      message = hasWinner
        ? `${auction.winnerNickname}님이 ₩${Number(auction.winningBidAmount).toLocaleString('ko-KR')}에 낙찰되었습니다.`
        : '입찰자가 없어 경매가 종료되었습니다.';
    } else if (isWinner) {
      message = `축하합니다! ₩${Number(auction.winningBidAmount).toLocaleString('ko-KR')}에 낙찰되었습니다.`;
    } else {
      message = '경매 결과를 확인해주세요.';
    }
    return {
      auction,
      isSeller,
      isWinner,
      hasWinner,
      message
    };
  });
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
  deleteAuctionFile,
  listUserAuctions,
  listUserNotifications,
  finalizeAuction
};
