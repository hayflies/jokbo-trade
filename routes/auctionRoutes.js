const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { ensureAuthenticated } = require('../middleware/auth');
const { listAuctions, createAuction, getAuctionById, placeBid, closeExpiredAuctions } = require('../services/auctionService');
const { findUserById, recordReputation } = require('../models/userModel');
const { listBidLogs } = require('../models/bidLogModel');

const router = express.Router();

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
    const { items, total, pages } = await listAuctions({ page, limit: 20 });
    res.render('auctions/index', { auctions: items, total, pages, currentPage: page });
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
        throw Object.assign(new Error('마감 시간은 현재 시각 이후여야 합니다.'), { status: 400 });
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
router.get('/:id', ensureAuthenticated, async (req, res, next) => {
  try {
    await closeExpiredAuctions();
    const auction = await getAuctionById(req.params.id);
    if (!auction) {
      return res.status(404).render('error', { error: new Error('경매를 찾을 수 없습니다.') });
    }
    const bidLogs = await listBidLogs(auction.id);
    res.render('auctions/show', { auction, bidLogs });
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
        return res.status(404).format({
          html: () => res.render('error', { error: new Error('경매를 찾을 수 없습니다.') }),
          json: () => res.json({ message: 'Auction not found' })
        });
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
router.get('/:id/download', ensureAuthenticated, async (req, res, next) => {
  try {
    const auction = await getAuctionById(req.params.id);
    if (!auction) {
      return res.status(404).render('error', { error: new Error('경매를 찾을 수 없습니다.') });
    }
    res.download(path.resolve(auction.filePath), auction.fileOriginalName);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
