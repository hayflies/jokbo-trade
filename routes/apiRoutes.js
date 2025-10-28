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
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: 0.5 point increments supported
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rating recorded
 */
router.post(
  '/auctions/:id/rate',
  ensureAuthenticated,
  [
    body('score')
      .isFloat({ min: 1, max: 5 })
      .withMessage('Score must be between 1 and 5.')
      .custom((value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          return false;
        }
        return Math.round(numeric * 2) === numeric * 2;
      })
      .withMessage('Score must be in 0.5 increments.')
  ],
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
      if (auction.status !== 'CLOSED') {
        return res.status(400).json({ message: 'Auction must be closed before rating' });
      }
      const userHasBid = auction.bids.some((bid) => bid.bidderId === req.session.user.id);
      if (!userHasBid) {
        return res.status(400).json({ message: 'Only bidders can rate this auction' });
      }
      if (!Array.isArray(auction.reviews)) {
        auction.reviews = [];
      }
      const alreadyReviewed = auction.reviews.some(
        (review) => String(review.bidderId) === String(req.session.user.id)
      );
      if (alreadyReviewed) {
        return res.status(400).json({ message: 'Rating already submitted for this auction' });
      }
      const normalizedScore = Number(req.body.score);
      if (!Number.isFinite(normalizedScore)) {
        return res.status(400).json({ message: 'Invalid score supplied' });
      }
      const comment = req.body.comment ? String(req.body.comment).trim() : '';
      let createdAt;
      let reviewPayload;
      try {
        await recordReputation({
          reviewerId: req.session.user.id,
          targetId: auction.sellerId,
          auctionId: String(auction.id),
          score: normalizedScore,
          comment
        });
      } catch (error) {
        if (error.code === 'REVIEW_EXISTS') {
          return res.status(400).json({ message: 'Rating already submitted for this auction' });
        }
        throw error;
      }
      createdAt = new Date();
      reviewPayload = {
        bidderId: req.session.user.id,
        bidderNickname: req.session.user.nickname,
        score: normalizedScore,
        comment,
        createdAt
      };
      auction.reviews.push(reviewPayload);
      auction.markModified('reviews');
      await auction.save();
      res.json({
        message: 'Rating saved',
        review: reviewPayload
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
