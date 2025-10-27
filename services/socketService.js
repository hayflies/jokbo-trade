const { Server } = require('socket.io');

let io;

function configureSocket(server) {
  io = new Server(server);
  io.on('connection', (socket) => {
    socket.on('joinAuction', (auctionId) => {
      socket.join(auctionId);
    });
  });
}

function broadcastBidUpdate(auction) {
  if (!io) return;
  io.to(auction.id).emit('bidUpdate', {
    auctionId: auction.id,
    currentPrice: auction.currentPrice,
    bids: auction.bids,
    endTime: auction.endTime
  });
  io.emit('auctionListUpdate', {
    auctionId: auction.id,
    currentPrice: auction.currentPrice,
    endTime: auction.endTime,
    bids: auction.bids
  });
}

module.exports = { configureSocket, broadcastBidUpdate };
