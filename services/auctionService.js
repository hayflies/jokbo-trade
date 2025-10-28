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
  if (!auction) {
    return auction;
  }
  if (auction.status === 'CLOSED' && (auction.winnerId || !auction.bids.length)) {
    return auction;
  }
  determineWinner(auction);
  auction.status = 'CLOSED';
  if (!auction.closedAt) {
    auction.closedAt = new Date();
  }
  await auction.save();
  broadcastBidUpdate(auction);
  return auction;
}

async function getAuctionById(id) {
  return Auction.findById(id);
}

async function createAuction({ title, description, startPrice, endTime, sellerId, sellerNickname, file }) {
  const normalizedStartPrice = Number(startPrice);
  if (
    !Number.isFinite(normalizedStartPrice) ||
    !Number.isInteger(normalizedStartPrice) ||
    normalizedStartPrice < 100 ||
    normalizedStartPrice % 100 !== 0
  ) {
    throw new Error('시작가는 100원 단위로 100원 이상이어야 합니다.');
  }
  const numericSellerId = Number(sellerId);
  if (!Number.isFinite(numericSellerId) || !Number.isInteger(numericSellerId)) {
    throw new Error('유효한 판매자 정보를 확인할 수 없습니다.');
  }
  const auction = new Auction({
    title,
    description,
    sellerId: numericSellerId,
    sellerNickname,
    startPrice: normalizedStartPrice,
    currentPrice: normalizedStartPrice,
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

  const normalizedBidderId = Number(bidderId);
  if (!Number.isFinite(normalizedBidderId) || !Number.isInteger(normalizedBidderId)) {
    throw Object.assign(new Error('유효한 사용자 정보를 확인할 수 없습니다.'), { status: 400 });
  }
  if (Number(auction.sellerId) === normalizedBidderId) {
    throw Object.assign(new Error('자신의 경매에는 입찰할 수 없습니다.'), { status: 400 });
  }

  const now = new Date();
  if (auction.endTime < now) {
    await finalizeAuction(auction);
    throw Object.assign(new Error('Auction has ended'), { status: 400 });
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || !Number.isInteger(normalizedAmount)) {
    throw Object.assign(new Error('유효한 입찰 금액을 입력해주세요.'), { status: 400 });
  }

  const currentPrice = Number(auction.currentPrice);
  if (!Number.isFinite(currentPrice)) {
    throw Object.assign(new Error('현재 경매 가격 정보를 불러올 수 없습니다.'), { status: 500 });
  }
  const minimumIncrement = currentPrice + 100;
  if (normalizedAmount < minimumIncrement) {
    throw Object.assign(new Error('입찰가는 현재가보다 최소 100원 이상 높아야 합니다.'), { status: 400 });
  }
  if (normalizedAmount % 100 !== 0) {
    throw Object.assign(new Error('입찰가는 100원 단위여야 합니다.'), { status: 400 });
  }

  auction.currentPrice = normalizedAmount;
  auction.bids.push({ bidderId: normalizedBidderId, bidderNickname, amount: normalizedAmount, createdAt: now });

  const oneMinute = 60 * 1000;
  if (auction.endTime.getTime() - now.getTime() <= oneMinute) {
      auction.endTime = new Date(auction.endTime.getTime() + oneMinute);
  }

  await auction.save();
  await recordBidLog({ auctionId: auction.id, bidderId: normalizedBidderId, amount: normalizedAmount });
  broadcastBidUpdate(auction);

  return auction;
}

async function closeExpiredAuctions() {
  const now = new Date();
  const [expired, closedWithoutWinner] = await Promise.all([
    Auction.find({ endTime: { $lt: now }, status: 'OPEN' }),
    Auction.find({ status: 'CLOSED', winnerId: null, 'bids.0': { $exists: true } })
  ]);
  await Promise.all([
    ...expired.map((auction) => finalizeAuction(auction)),
    ...closedWithoutWinner.map((auction) => finalizeAuction(auction))
  ]);
}

async function listUserAuctions(userId) {
  const [open, closed] = await Promise.all([
    Auction.find({ sellerId: userId, status: 'OPEN' }).sort(buildSort('OPEN')),
    Auction.find({ sellerId: userId, status: 'CLOSED' }).sort(buildSort('CLOSED'))
  ]);
  return {
    open: open.map((auction) => auction.toObject({ virtuals: true })),
    closed: closed.map((auction) => auction.toObject({ virtuals: true }))
  };
}

async function listUserNotifications(userId) {
  const auctions = await Auction.find({
    status: 'CLOSED',
    $or: [{ sellerId: userId }, { winnerId: userId }]
  }).sort(buildSort('CLOSED'));

  const notifications = [];

  auctions.forEach((auctionDoc) => {
    const auction = auctionDoc.toObject({ virtuals: true });
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

    notifications.push({
      auction,
      isSeller,
      isWinner,
      hasWinner,
      message,
      type: 'STATUS',
      createdAt: auction.closedAt || auction.endTime
    });

    if (isSeller && Array.isArray(auction.reviews) && auction.reviews.length) {
      auction.reviews.forEach((review) => {
        const createdAt = review.createdAt ? new Date(review.createdAt) : auction.closedAt || auction.endTime;
        notifications.push({
          auction,
          isSeller: true,
          isWinner,
          hasWinner,
          message: `${review.bidderNickname}님이 거래 후기를 남겼습니다.`,
          type: 'REVIEW',
          createdAt,
          review
        });
      });
    }
  });

  notifications.sort((a, b) => {
    const left = new Date(a.createdAt || a.auction.closedAt || a.auction.endTime).getTime();
    const right = new Date(b.createdAt || b.auction.closedAt || b.auction.endTime).getTime();
    return right - left;
  });

  return notifications;
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
