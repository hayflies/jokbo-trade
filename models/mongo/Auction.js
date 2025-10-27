const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    bidderId: { type: Number, required: true },
    bidderNickname: { type: String, required: true },
    amount: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const auctionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    sellerId: { type: Number, required: true },
    sellerNickname: { type: String, required: true },
    startPrice: { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    endTime: { type: Date, required: true },
    filePath: { type: String, required: true },
    fileOriginalName: { type: String, required: true },
    bids: [bidSchema],
    createdAt: { type: Date, default: Date.now },
    status: { type: String, default: 'OPEN', enum: ['OPEN', 'CLOSED'] }
  },
  {
    timestamps: true
  }
);

auctionSchema.index({ endTime: 1 });
auctionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Auction', auctionSchema);
