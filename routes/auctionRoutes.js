const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  Types: { ObjectId }
} = require('mongoose');
const { body, validationResult } = require('express-validator');
const { ensureAuthenticated } = require('../middleware/auth');
const {
  listAuctions,
  createAuction,
  getAuctionById,
  placeBid,
  closeExpiredAuctions,
  listUserAuctions,
  listUserNotifications
} = require('../services/auctionService');
const { findUserById, recordReputation } = require('../models/userModel');
const { listBidLogs } = require('../models/bidLogModel');

const router = express.Router();

function respondAuctionNotFound(req, res) {
  const error = new Error('경매를 찾을 수 없습니다.');
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(404).json({ message: error.message });
  }
  return res.status(404).render('error', { error });
}

function ensureValidAuctionId(req, res, next) {
  if (!ObjectId.isValid(req.params.id)) {
    return respondAuctionNotFound(req, res);
  }
  return next();
}

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('이미지 또는 PDF 파일만 업로드할 수 있습니다.'));
    }
    cb(null, true);
  }
});

/**
 * @swagger
 * tags:
 *   name: Auctions
 *   description: Auction management
 */

/**
 * @swagger
 * /auctions:
 *   get:
 *     summary: List auctions with pagination
 *     tags: [Auctions]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Auction list page
 */
router.get('/', async (req, res, next) => {
  try {
    await closeExpiredAuctions();
    const page = parseInt(req.query.page || '1', 10);
    const [openResult, closedResult] = await Promise.all([
      listAuctions({ page, limit: 20, status: 'OPEN' }),
      listAuctions({ page, limit: 20, status: 'CLOSED' })
    ]);

    res.render('auctions/index', {
      openAuctions: openResult.items,
      closedAuctions: closedResult.items,
      openTotal: openResult.total,
      openPages: openResult.pages,
      closedTotal: closedResult.total,
      closedPages: closedResult.pages,
      currentPage: page
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auctions/new:
 *   get:
 *     summary: Render auction creation form
 *     tags: [Auctions]
 *     responses:
 *       200:
 *         description: HTML form
 */
router.get('/new', ensureAuthenticated, (req, res) => {
  res.render('auctions/new');
});

/**
 * @swagger
 * /auctions:
 *   post:
 *     summary: Create a new auction
 *     tags: [Auctions]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, description, startPrice, endTime, file]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startPrice:
 *                 type: number
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Auction created
 */
router.post(
  '/',
  ensureAuthenticated,
  upload.single('file'),
  [
    body('title').notEmpty().withMessage('제목은 필수입니다.'),
    body('description').notEmpty().withMessage('설명은 필수입니다.'),
    body('startPrice').isFloat({ gt: 0 }).withMessage('시작가는 0보다 커야 합니다.'),
    body('endTime').notEmpty().withMessage('마감 시간을 입력하세요.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach((e) => req.flash('error', e.msg));
      return res.status(400).format({
        html: () => res.redirect('/auctions/new'),
        json: () => res.json({ errors: errors.array() })
      });
    }
    if (!req.file) {
      req.flash('error', '파일은 필수입니다.');
      return res.status(400).format({
        html: () => res.redirect('/auctions/new'),
        json: () => res.json({ message: 'File is required' })
      });
    }
    try {
      const { title, description, startPrice, endTime } = req.body;
      const seller = req.session.user;
      const parsedEndTime = new Date(endTime);
      if (Number.isNaN(parsedEndTime.getTime())) {
        throw Object.assign(new Error('유효한 종료 시간을 입력하세요.'), { status: 400 });
      }
      if (parsedEndTime <= new Date()) {
        const message = '마감 시간은 현재 시각 이후여야 합니다.';
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
          return res.status(400).json({ message });
        }
        req.flash('warning', message);
        return res.redirect('/auctions/new');
      }
      const numericPrice = Number(startPrice);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw Object.assign(new Error('시작가는 0보다 커야 합니다.'), { status: 400 });
      }
      const auction = await createAuction({
        title,
        description,
        startPrice: numericPrice,
        endTime: parsedEndTime,
        sellerId: seller.id,
        sellerNickname: seller.nickname,
        file: req.file
      });
      req.flash('success', '경매가 생성되었습니다.');
      return res.status(201).format({
        html: () => res.redirect(`/auctions/${auction.id}`),
        json: () => res.json({ message: 'Auction created', auction })
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/my', ensureAuthenticated, async (req, res, next) => {
  try {
    await closeExpiredAuctions();
    const { open, closed } = await listUserAuctions(req.session.user.id);
    res.render('auctions/mine', { openAuctions: open, closedAuctions: closed });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications', ensureAuthenticated, async (req, res, next) => {
  try {
    await closeExpiredAuctions();
    const notifications = await listUserNotifications(req.session.user.id);
    res.render('auctions/notifications', { notifications });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auctions/{id}:
 *   get:
 *     summary: View a single auction
 *     tags: [Auctions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auction details
 */
router.get('/:id', ensureAuthenticated, ensureValidAuctionId, async (req, res, next) => {
    try {
        await closeExpiredAuctions();
        const auctionDoc = await getAuctionById(req.params.id);
        if (!auctionDoc) {
            return res.status(404).render('error', { error: new Error('경매를 찾을 수 없습니다.') });
        }
        const auction = auctionDoc.toObject({ virtuals: true });
        const currentUser = req.session.user;
        const currentUserIdStr = String(currentUser.id);
        const sellerIdStr = String(auction.sellerId);
        const winnerIdStr = auction.winnerId == null ? null : String(auction.winnerId);
        const isSeller = sellerIdStr === currentUserIdStr;
        const isWinner = winnerIdStr !== null && winnerIdStr === currentUserIdStr;
        const isAuctionOpen = auction.status === 'OPEN' && new Date(auction.endTime) > new Date();
        const hasBid = Array.isArray(auction.bids)
            ? auction.bids.some((bid) => String(bid.bidderId) === currentUserIdStr)
            : false;
        const canBid = isAuctionOpen && !isSeller;
        const canRate = auction.status === 'CLOSED' && hasBid && !isSeller;
        const allowDownload = auction.status === 'CLOSED' && (isSeller || hasBid);
        const bidLogs = await listBidLogs(auction.id);
        res.render('auctions/show', {
            auction,
            bidLogs,
            isSeller,
            isWinner,
            canBid,
            canRate,
            allowDownload,
            userHasBid: hasBid
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /auctions/{id}/bids:
 *   post:
 *     summary: Place a bid on an auction
 *     tags: [Auctions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Bid placed
 */
router.post(
  '/:id/bids',
  ensureAuthenticated,
  ensureValidAuctionId,
  [body('amount').isFloat({ gt: 0 }).withMessage('입찰가는 0보다 커야 합니다.')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).format({
        html: () => {
          errors.array().forEach((e) => req.flash('error', e.msg));
          res.redirect(`/auctions/${req.params.id}`);
        },
        json: () => res.json({ errors: errors.array() })
      });
    }
    try {
      const amount = Number(req.body.amount);
      const user = req.session.user;
      const auction = await placeBid({
        auctionId: req.params.id,
        bidderId: user.id,
        bidderNickname: user.nickname,
        amount
      });
      req.flash('success', '입찰이 완료되었습니다.');
      return res.status(200).format({
        html: () => res.redirect(`/auctions/${req.params.id}`),
        json: () => res.json({ message: 'Bid placed', auction })
      });
    } catch (error) {
      if (error.status) {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
          return res.status(error.status).json({ message: error.message });
        }
        req.flash('error', error.message);
        return res.redirect(`/auctions/${req.params.id}`);
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /auctions/{id}/rate:
 *   post:
 *     summary: Leave a reputation score for the seller
 *     tags: [Auctions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [score]
 *             properties:
 *               score:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reputation recorded
 */
router.post(
  '/:id/rate',
  ensureAuthenticated,
  ensureValidAuctionId,
  [body('score').isInt({ min: 1, max: 5 }).withMessage('평점은 1에서 5 사이여야 합니다.')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).format({
        html: () => {
          errors.array().forEach((e) => req.flash('error', e.msg));
          res.redirect(`/auctions/${req.params.id}`);
        },
        json: () => res.json({ errors: errors.array() })
      });
    }
    try {
      const auction = await getAuctionById(req.params.id);
      if (!auction) {
        return respondAuctionNotFound(req, res);
      }
      if (auction.sellerId === req.session.user.id) {
        req.flash('error', '자신의 경매에는 평점을 남길 수 없습니다.');
        return res.status(400).format({
          html: () => res.redirect(`/auctions/${req.params.id}`),
          json: () => res.json({ message: 'Cannot rate your own auction' })
        });
      }
      await recordReputation({
        reviewerId: req.session.user.id,
        targetId: auction.sellerId,
        score: Number(req.body.score),
        comment: req.body.comment || ''
      });
      const updatedSeller = await findUserById(auction.sellerId);
      if (req.session.user.id === updatedSeller.id) {
        req.session.user.reputationScore = Number(updatedSeller.reputation_score);
        req.session.user.reputationCount = updatedSeller.reputation_count;
      }
      req.flash('success', '평가가 등록되었습니다.');
      return res.status(200).format({
        html: () => res.redirect(`/auctions/${req.params.id}`),
        json: () => res.json({ message: 'Reputation recorded' })
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /auctions/{id}/download:
 *   get:
 *     summary: Download auction file
 *     tags: [Auctions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File download
 */
router.get('/:id/download', ensureAuthenticated, ensureValidAuctionId, async (req, res, next) => {
    try {
        await closeExpiredAuctions();
        const auction = await getAuctionById(req.params.id);
        if (!auction) {
            return respondAuctionNotFound(req, res);
        }
        const requesterId = String(req.session.user.id);
        const isSeller = String(auction.sellerId) === requesterId;
        const hasBid = Array.isArray(auction.bids)
            ? auction.bids.some((bid) => String(bid.bidderId) === requesterId)
            : false;
        if (!isSeller && !hasBid) {
            req.flash('error', '입찰에 참여한 사용자만 자료를 내려받을 수 있습니다.');
            return res.redirect(`/auctions/${req.params.id}`);
        }
        if (auction.status !== 'CLOSED') {
            req.flash('error', '경매 종료 후에만 자료를 내려받을 수 있습니다.');
            return res.redirect(`/auctions/${req.params.id}`);
        }
        res.download(path.resolve(auction.filePath), auction.fileOriginalName);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
