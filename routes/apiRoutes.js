const express = require('express');
const { body, validationResult } = require('express-validator');
const { listAuctions, getAuctionById, placeBid, closeExpiredAuctions } = require('../services/auctionService');
const { recordReputation } = require('../models/userModel');
const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: API
 *   description: JSON endpoints for integrations
 */

/**
 * @swagger
 * /api/auctions:
 *   get:
 *     summary: Retrieve auctions as JSON
 *     tags: [API]
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
 *         description: Auction list JSON
 */
router.get('/auctions', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const { items, total, pages } = await listAuctions({ page, limit });
    res.json({ page, pages, total, items });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auctions/{id}:
 *   get:
 *     summary: Retrieve an auction by ID
 *     tags: [API]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auction detail JSON
 */
router.get('/auctions/:id', async (req, res, next) => {
  try {
    await closeExpiredAuctions();
    const auction = await getAuctionById(req.params.id);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    res.json(auction);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auctions/{id}/bids:
 *   post:
 *     summary: Place a bid via API
 *     tags: [API]
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
 *         description: Bid success
 */
router.post(
  '/auctions/:id/bids',
  ensureAuthenticated,
  [body('amount').isFloat({ gt: 0 })],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const auction = await placeBid({
        auctionId: req.params.id,
        bidderId: req.session.user.id,
        bidderNickname: req.session.user.nickname,
        amount: Number(req.body.amount)
      });
      res.json({ message: 'Bid placed', auction });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/auctions/{id}/rate:
 *   post:
 *     summary: Rate the seller via API
 *     tags: [API]
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
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rating recorded
 */
router.post(
  '/auctions/:id/rate',
  ensureAuthenticated,
  [body('score').isInt({ min: 1, max: 5 })],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const auction = await getAuctionById(req.params.id);
      if (!auction) {
        return res.status(404).json({ message: 'Auction not found' });
      }
      if (auction.sellerId === req.session.user.id) {
        return res.status(400).json({ message: 'Cannot rate your own auction' });
      }
      await recordReputation({
        reviewerId: req.session.user.id,
        targetId: auction.sellerId,
        score: Number(req.body.score),
        comment: req.body.comment || ''
      });
      res.json({ message: 'Rating saved' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
