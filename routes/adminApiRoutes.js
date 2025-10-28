const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { ensureAdmin } = require('../middleware/auth');
const store = require('../services/adminApiStore');

const router = express.Router();

router.use(ensureAdmin);

function hasValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

store.seedStore();

/**
 * @swagger
 * tags:
 *   name: AdminAPI
 *   description: Administrative JSON APIs restricted to administrators
 */

/**
 * @swagger
 * /admin/api/system/health:
 *   get:
 *     summary: Retrieve current system health snapshot
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Health result payload
 */
router.get('/system/health', (req, res) => {
  res.json(store.getSystemHealth());
});

/**
 * @swagger
 * /admin/api/system/stats:
 *   get:
 *     summary: Retrieve aggregate administrative statistics
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Aggregate metrics payload
 */
router.get('/system/stats', (req, res) => {
  res.json(store.getSystemStats());
});

/**
 * @swagger
 * /admin/api/users:
 *   get:
 *     summary: List all registered users with administrative metadata
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Array of users
 */
router.get('/users', (req, res) => {
  res.json(store.listUsers());
});

/**
 * @swagger
 * /admin/api/users/{id}:
 *   get:
 *     summary: Retrieve a single user profile
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User record
 *       404:
 *         description: User not found
 */
router.get('/users/:id', (req, res) => {
  const user = store.getUser(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(user);
});

/**
 * @swagger
 * /admin/api/users/{id}/activity:
 *   get:
 *     summary: Retrieve a user activity timeline
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Activity list
 *       404:
 *         description: User not found
 */
router.get('/users/:id/activity', [query('limit').optional().isInt({ min: 1, max: 100 })], (req, res) => {
  if (hasValidationErrors(req, res)) {
    return;
  }
  const user = store.getUser(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  res.json(user.activity.slice(0, limit));
});

/**
 * @swagger
 * /admin/api/auctions:
 *   get:
 *     summary: List auctions for administrative review
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Auction array
 */
router.get('/auctions', (req, res) => {
  res.json(store.listAuctions());
});

/**
 * @swagger
 * /admin/api/auctions/{id}:
 *   get:
 *     summary: Retrieve auction metadata
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auction detail
 *       404:
 *         description: Auction not found
 */
router.get('/auctions/:id', (req, res) => {
  const auction = store.getAuction(req.params.id);
  if (!auction) {
    return res.status(404).json({ message: 'Auction not found' });
  }
  return res.json(auction);
});

/**
 * @swagger
 * /admin/api/auctions/{id}/bids:
 *   get:
 *     summary: Retrieve bids submitted to an auction
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bid array
 *       404:
 *         description: Auction not found
 */
router.get('/auctions/:id/bids', (req, res) => {
  const auction = store.getAuction(req.params.id);
  if (!auction) {
    return res.status(404).json({ message: 'Auction not found' });
  }
  return res.json(auction.bids);
});

/**
 * @swagger
 * /admin/api/reports:
 *   get:
 *     summary: List abuse reports
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Report array
 */
router.get('/reports', (req, res) => {
  res.json(store.listReports());
});

/**
 * @swagger
 * /admin/api/reports/{id}:
 *   get:
 *     summary: Retrieve a specific abuse report
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report detail
 *       404:
 *         description: Report not found
 */
router.get('/reports/:id', (req, res) => {
  const report = store.getReport(req.params.id);
  if (!report) {
    return res.status(404).json({ message: 'Report not found' });
  }
  return res.json(report);
});

/**
 * @swagger
 * /admin/api/transactions:
 *   get:
 *     summary: List payment transactions
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Transaction array
 */
router.get('/transactions', (req, res) => {
  res.json(store.listTransactions());
});

/**
 * @swagger
 * /admin/api/transactions/{id}:
 *   get:
 *     summary: Retrieve a transaction
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction detail
 *       404:
 *         description: Transaction not found
 */
router.get('/transactions/:id', (req, res) => {
  const transaction = store.getTransaction(req.params.id);
  if (!transaction) {
    return res.status(404).json({ message: 'Transaction not found' });
  }
  return res.json(transaction);
});

/**
 * @swagger
 * /admin/api/payouts:
 *   get:
 *     summary: List pending or completed payouts
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Payout array
 */
router.get('/payouts', (req, res) => {
  res.json(store.listPayouts());
});

/**
 * @swagger
 * /admin/api/announcements:
 *   get:
 *     summary: List platform announcements
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Announcement array
 */
router.get('/announcements', (req, res) => {
  res.json(store.listAnnouncements());
});

/**
 * @swagger
 * /admin/api/settings:
 *   get:
 *     summary: Retrieve platform configuration settings
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Settings array
 */
router.get('/settings', (req, res) => {
  res.json(store.listSettings());
});

/**
 * @swagger
 * /admin/api/users:
 *   post:
 *     summary: Create a new user record for administrative testing
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created user
 */
router.post(
  '/users',
  [body('name').isString().notEmpty(), body('email').isEmail(), body('status').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const user = store.createUser({
      name: req.body.name,
      email: req.body.email,
      status: req.body.status
    });
    res.status(201).json(user);
  }
);

/**
 * @swagger
 * /admin/api/users/{id}/warn:
 *   post:
 *     summary: Append a warning to a user
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Warning created
 *       404:
 *         description: User not found
 */
router.post(
  '/users/:id/warn',
  [body('message').isString().notEmpty()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const warning = store.addUserWarning(req.params.id, req.body.message);
    if (!warning) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(warning);
  }
);

/**
 * @swagger
 * /admin/api/auctions:
 *   post:
 *     summary: Create an administrative auction entry
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, sellerId]
 *             properties:
 *               title:
 *                 type: string
 *               sellerId:
 *                 type: string
 *               status:
 *                 type: string
 *               startingPrice:
 *                 type: number
 *     responses:
 *       201:
 *         description: Auction created
 */
router.post(
  '/auctions',
  [
    body('title').isString().notEmpty(),
    body('sellerId').isString().notEmpty(),
    body('status').optional().isString(),
    body('startingPrice').optional().isFloat({ min: 0 })
  ],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const auction = store.createAuction({
      title: req.body.title,
      sellerId: req.body.sellerId,
      status: req.body.status,
      startingPrice: req.body.startingPrice ? Number(req.body.startingPrice) : undefined
    });
    res.status(201).json(auction);
  }
);

/**
 * @swagger
 * /admin/api/auctions/{id}/bids:
 *   post:
 *     summary: Add a bid to an auction
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bidderId, bidderName, amount]
 *             properties:
 *               bidderId:
 *                 type: string
 *               bidderName:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Bid created
 *       404:
 *         description: Auction not found
 */
router.post(
  '/auctions/:id/bids',
  [
    body('bidderId').isString().notEmpty(),
    body('bidderName').isString().notEmpty(),
    body('amount').isFloat({ gt: 0 })
  ],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const bid = store.addAuctionBid(req.params.id, {
      bidderId: req.body.bidderId,
      bidderName: req.body.bidderName,
      amount: Number(req.body.amount)
    });
    if (!bid) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    res.json(bid);
  }
);

/**
 * @swagger
 * /admin/api/reports:
 *   post:
 *     summary: Create an abuse report
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, auctionId, reporterId]
 *             properties:
 *               type:
 *                 type: string
 *               auctionId:
 *                 type: string
 *               reporterId:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report created
 */
router.post(
  '/reports',
  [
    body('type').isString().notEmpty(),
    body('auctionId').isString().notEmpty(),
    body('reporterId').isString().notEmpty(),
    body('description').optional().isString()
  ],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const report = store.createReport({
      type: req.body.type,
      auctionId: req.body.auctionId,
      reporterId: req.body.reporterId,
      description: req.body.description
    });
    res.status(201).json(report);
  }
);

/**
 * @swagger
 * /admin/api/reports/{id}/resolve:
 *   post:
 *     summary: Resolve a report with contextual information
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resolution]
 *             properties:
 *               resolution:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report resolved
 *       404:
 *         description: Report not found
 */
router.post(
  '/reports/:id/resolve',
  [body('resolution').isString().notEmpty()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const report = store.resolveReport(req.params.id, req.body.resolution);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  }
);

/**
 * @swagger
 * /admin/api/transactions:
 *   post:
 *     summary: Record a payment transaction
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [auctionId, amount, buyerId]
 *             properties:
 *               auctionId:
 *                 type: string
 *               amount:
 *                 type: number
 *               buyerId:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transaction created
 */
router.post(
  '/transactions',
  [
    body('auctionId').isString().notEmpty(),
    body('amount').isFloat({ gt: 0 }),
    body('buyerId').isString().notEmpty(),
    body('status').optional().isString()
  ],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const transaction = store.createTransaction({
      auctionId: req.body.auctionId,
      amount: Number(req.body.amount),
      buyerId: req.body.buyerId,
      status: req.body.status
    });
    res.status(201).json(transaction);
  }
);

/**
 * @swagger
 * /admin/api/transactions/{id}/refund:
 *   post:
 *     summary: Issue a refund for a transaction
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund recorded
 *       404:
 *         description: Transaction not found
 */
router.post(
  '/transactions/:id/refund',
  [body('amount').isFloat({ gt: 0 }), body('reason').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const refund = store.recordRefund(req.params.id, Number(req.body.amount), req.body.reason);
    if (!refund) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json(refund);
  }
);

/**
 * @swagger
 * /admin/api/payouts:
 *   post:
 *     summary: Create a payout record
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [transactionId, amount, recipientId]
 *             properties:
 *               transactionId:
 *                 type: string
 *               amount:
 *                 type: number
 *               recipientId:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payout created
 */
router.post(
  '/payouts',
  [
    body('transactionId').isString().notEmpty(),
    body('amount').isFloat({ gt: 0 }),
    body('recipientId').isString().notEmpty(),
    body('status').optional().isString()
  ],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const payout = store.createPayout({
      transactionId: req.body.transactionId,
      amount: Number(req.body.amount),
      recipientId: req.body.recipientId,
      status: req.body.status
    });
    res.status(201).json(payout);
  }
);

/**
 * @swagger
 * /admin/api/announcements:
 *   post:
 *     summary: Create a platform announcement
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Announcement created
 */
router.post(
  '/announcements',
  [body('title').isString().notEmpty(), body('body').isString().notEmpty(), body('status').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const announcement = store.createAnnouncement({
      title: req.body.title,
      body: req.body.body,
      status: req.body.status
    });
    res.status(201).json(announcement);
  }
);

/**
 * @swagger
 * /admin/api/announcements/{id}/publish:
 *   post:
 *     summary: Publish an announcement
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Announcement published
 *       404:
 *         description: Announcement not found
 */
router.post('/announcements/:id/publish', (req, res) => {
  const announcement = store.publishAnnouncement(req.params.id);
  if (!announcement) {
    return res.status(404).json({ message: 'Announcement not found' });
  }
  return res.json(announcement);
});

/**
 * @swagger
 * /admin/api/settings:
 *   post:
 *     summary: Create a configuration entry
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, value]
 *             properties:
 *               key:
 *                 type: string
 *               value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                   - type: boolean
 *     responses:
 *       201:
 *         description: Setting created
 */
router.post(
  '/settings',
  [body('key').isString().notEmpty(), body('value').exists()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const setting = store.createSetting(req.body.key, req.body.value);
    res.status(201).json(setting);
  }
);

/**
 * @swagger
 * /admin/api/integrations/test:
 *   post:
 *     summary: Execute an integration connectivity test
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Integration test result
 *       404:
 *         description: Integration not found
 */
router.post(
  '/integrations/test',
  [body('name').isString().notEmpty(), body('payload').optional().isObject()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const result = store.testIntegration(req.body.name, req.body.payload);
    if (!result) {
      return res.status(404).json({ message: 'Integration not found' });
    }
    res.json(result);
  }
);

/**
 * @swagger
 * /admin/api/audit-logs/search:
 *   post:
 *     summary: Search audit logs with filters
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actorId:
 *                 type: string
 *               action:
 *                 type: string
 *               resource:
 *                 type: string
 *     responses:
 *       200:
 *         description: Filtered audit logs
 */
router.post(
  '/audit-logs/search',
  [body('actorId').optional().isString(), body('action').optional().isString(), body('resource').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const logs = store.searchAuditLogs({
      actorId: req.body.actorId,
      action: req.body.action,
      resource: req.body.resource
    });
    res.json(logs);
  }
);

/**
 * @swagger
 * /admin/api/notifications/broadcast:
 *   post:
 *     summary: Broadcast a notification to a target audience
 *     tags: [AdminAPI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message, audience]
 *             properties:
 *               message:
 *                 type: string
 *               audience:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       201:
 *         description: Notification created
 */
router.post(
  '/notifications/broadcast',
  [body('message').isString().notEmpty(), body('audience').isString().notEmpty(), body('type').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const notification = store.createNotification({
      message: req.body.message,
      audience: req.body.audience,
      type: req.body.type || 'BROADCAST'
    });
    res.status(201).json(notification);
  }
);

/**
 * @swagger
 * /admin/api/users/{id}:
 *   put:
 *     summary: Update user information
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user
 *       404:
 *         description: User not found
 */
router.put(
  '/users/:id',
  [body('name').optional().isString(), body('email').optional().isEmail(), body('status').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const user = store.updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  }
);

/**
 * @swagger
 * /admin/api/users/{id}/status:
 *   put:
 *     summary: Update user status
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user status
 *       404:
 *         description: User not found
 */
router.put(
  '/users/:id/status',
  [body('status').isString().notEmpty()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const user = store.setUserStatus(req.params.id, req.body.status);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  }
);

/**
 * @swagger
 * /admin/api/auctions/{id}:
 *   put:
 *     summary: Update auction fields
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               status:
 *                 type: string
 *               startingPrice:
 *                 type: number
 *     responses:
 *       200:
 *         description: Updated auction
 *       404:
 *         description: Auction not found
 */
router.put(
  '/auctions/:id',
  [
    body('title').optional().isString(),
    body('status').optional().isString(),
    body('startingPrice').optional().isFloat({ min: 0 })
  ],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const payload = { ...req.body };
    if (payload.startingPrice !== undefined) {
      payload.startingPrice = Number(payload.startingPrice);
    }
    const auction = store.updateAuction(req.params.id, payload);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    res.json(auction);
  }
);

/**
 * @swagger
 * /admin/api/auctions/{id}/status:
 *   put:
 *     summary: Update auction status
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated auction status
 *       404:
 *         description: Auction not found
 */
router.put(
  '/auctions/:id/status',
  [body('status').isString().notEmpty()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const auction = store.setAuctionStatus(req.params.id, req.body.status);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    res.json(auction);
  }
);

/**
 * @swagger
 * /admin/api/reports/{id}:
 *   put:
 *     summary: Update report details
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               status:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated report
 *       404:
 *         description: Report not found
 */
router.put(
  '/reports/:id',
  [body('type').optional().isString(), body('status').optional().isString(), body('description').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const report = store.updateReport(req.params.id, req.body);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  }
);

/**
 * @swagger
 * /admin/api/reports/{id}/assign:
 *   put:
 *     summary: Assign a report to a staff member
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assigneeId]
 *             properties:
 *               assigneeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report assignment updated
 *       404:
 *         description: Report not found
 */
router.put(
  '/reports/:id/assign',
  [body('assigneeId').isString().notEmpty()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const report = store.assignReport(req.params.id, req.body.assigneeId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  }
);

/**
 * @swagger
 * /admin/api/transactions/{id}:
 *   put:
 *     summary: Update a transaction record
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated transaction
 *       404:
 *         description: Transaction not found
 */
router.put(
  '/transactions/:id',
  [body('amount').optional().isFloat({ gt: 0 }), body('status').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const payload = { ...req.body };
    if (payload.amount !== undefined) {
      payload.amount = Number(payload.amount);
    }
    const transaction = store.updateTransaction(req.params.id, payload);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json(transaction);
  }
);

/**
 * @swagger
 * /admin/api/transactions/{id}/status:
 *   put:
 *     summary: Change transaction status
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated transaction status
 *       404:
 *         description: Transaction not found
 */
router.put(
  '/transactions/:id/status',
  [body('status').isString().notEmpty()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const transaction = store.setTransactionStatus(req.params.id, req.body.status);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json(transaction);
  }
);

/**
 * @swagger
 * /admin/api/payouts/{id}:
 *   put:
 *     summary: Update payout information
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated payout
 *       404:
 *         description: Payout not found
 */
router.put(
  '/payouts/:id',
  [body('amount').optional().isFloat({ gt: 0 }), body('status').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const payload = { ...req.body };
    if (payload.amount !== undefined) {
      payload.amount = Number(payload.amount);
    }
    const payout = store.updatePayout(req.params.id, payload);
    if (!payout) {
      return res.status(404).json({ message: 'Payout not found' });
    }
    res.json(payout);
  }
);

/**
 * @swagger
 * /admin/api/payouts/{id}/status:
 *   put:
 *     summary: Update payout status
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated payout status
 *       404:
 *         description: Payout not found
 */
router.put(
  '/payouts/:id/status',
  [body('status').isString().notEmpty()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const payout = store.setPayoutStatus(req.params.id, req.body.status);
    if (!payout) {
      return res.status(404).json({ message: 'Payout not found' });
    }
    res.json(payout);
  }
);

/**
 * @swagger
 * /admin/api/announcements/{id}:
 *   put:
 *     summary: Update announcement content
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated announcement
 *       404:
 *         description: Announcement not found
 */
router.put(
  '/announcements/:id',
  [body('title').optional().isString(), body('body').optional().isString(), body('status').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const announcement = store.updateAnnouncement(req.params.id, req.body);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    res.json(announcement);
  }
);

/**
 * @swagger
 * /admin/api/settings/{key}:
 *   put:
 *     summary: Update a configuration entry
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                   - type: boolean
 *     responses:
 *       200:
 *         description: Updated setting
 */
router.put(
  '/settings/:key',
  [body('value').exists()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const setting = store.updateSetting(req.params.key, { value: req.body.value });
    res.json(setting);
  }
);

/**
 * @swagger
 * /admin/api/notifications/{id}:
 *   put:
 *     summary: Update a notification payload
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               audience:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated notification
 *       404:
 *         description: Notification not found
 */
router.put(
  '/notifications/:id',
  [body('message').optional().isString(), body('audience').optional().isString(), body('status').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const notification = store.updateNotification(req.params.id, req.body);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  }
);

/**
 * @swagger
 * /admin/api/audit-logs/{id}/flag:
 *   put:
 *     summary: Flag an audit log entry
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               flagged:
 *                 type: boolean
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Audit log updated
 *       404:
 *         description: Audit log not found
 */
router.put(
  '/audit-logs/:id/flag',
  [body('flagged').optional().isBoolean(), body('reason').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const flagged =
      req.body.flagged === undefined ? true : req.body.flagged === true || req.body.flagged === 'true';
    const log = store.flagAuditLog(req.params.id, flagged, req.body.reason);
    if (!log) {
      return res.status(404).json({ message: 'Audit log not found' });
    }
    res.json(log);
  }
);

/**
 * @swagger
 * /admin/api/integrations/{name}:
 *   put:
 *     summary: Update integration configuration
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config:
 *                 type: object
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Integration updated
 *       404:
 *         description: Integration not found
 */
router.put(
  '/integrations/:name',
  [body('config').optional().isObject(), body('status').optional().isString()],
  (req, res) => {
    if (hasValidationErrors(req, res)) {
      return;
    }
    const integration = store.updateIntegration(req.params.name, req.body);
    if (!integration) {
      return res.status(404).json({ message: 'Integration not found' });
    }
    res.json(integration);
  }
);

/**
 * @swagger
 * /admin/api/users/{id}:
 *   delete:
 *     summary: Delete a user record
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/users/:id', (req, res) => {
  res.json({ deleted: store.deleteUser(req.params.id) });
});

/**
 * @swagger
 * /admin/api/users/{id}/warnings/{warningId}:
 *   delete:
 *     summary: Remove a user warning
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: warningId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Removed warning payload when successful
 *       404:
 *         description: User or warning not found
 */
router.delete('/users/:id/warnings/:warningId', (req, res) => {
  const removed = store.removeUserWarning(req.params.id, req.params.warningId);
  if (!removed) {
    return res.status(404).json({ message: 'Warning not found' });
  }
  return res.json(removed);
});

/**
 * @swagger
 * /admin/api/auctions/{id}:
 *   delete:
 *     summary: Remove an auction entry
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/auctions/:id', (req, res) => {
  res.json({ deleted: store.deleteAuction(req.params.id) });
});

/**
 * @swagger
 * /admin/api/auctions/{id}/bids/{bidId}:
 *   delete:
 *     summary: Remove a bid from an auction
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: bidId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Removed bid payload when successful
 *       404:
 *         description: Auction or bid not found
 */
router.delete('/auctions/:id/bids/:bidId', (req, res) => {
  const removed = store.removeAuctionBid(req.params.id, req.params.bidId);
  if (!removed) {
    return res.status(404).json({ message: 'Bid not found' });
  }
  return res.json(removed);
});

/**
 * @swagger
 * /admin/api/reports/{id}:
 *   delete:
 *     summary: Delete a report
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/reports/:id', (req, res) => {
  res.json({ deleted: store.deleteReport(req.params.id) });
});

/**
 * @swagger
 * /admin/api/transactions/{id}:
 *   delete:
 *     summary: Delete a transaction
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/transactions/:id', (req, res) => {
  res.json({ deleted: store.deleteTransaction(req.params.id) });
});

/**
 * @swagger
 * /admin/api/payouts/{id}:
 *   delete:
 *     summary: Delete a payout record
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/payouts/:id', (req, res) => {
  res.json({ deleted: store.deletePayout(req.params.id) });
});

/**
 * @swagger
 * /admin/api/announcements/{id}:
 *   delete:
 *     summary: Delete an announcement
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/announcements/:id', (req, res) => {
  res.json({ deleted: store.deleteAnnouncement(req.params.id) });
});

/**
 * @swagger
 * /admin/api/settings/{key}:
 *   delete:
 *     summary: Delete a configuration entry
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/settings/:key', (req, res) => {
  res.json({ deleted: store.deleteSetting(req.params.key) });
});

/**
 * @swagger
 * /admin/api/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/notifications/:id', (req, res) => {
  res.json({ deleted: store.deleteNotification(req.params.id) });
});

/**
 * @swagger
 * /admin/api/audit-logs/{id}:
 *   delete:
 *     summary: Delete an audit log entry
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/audit-logs/:id', (req, res) => {
  res.json({ deleted: store.deleteAuditLog(req.params.id) });
});

/**
 * @swagger
 * /admin/api/integrations/{name}:
 *   delete:
 *     summary: Delete an integration configuration
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/integrations/:name', (req, res) => {
  res.json({ deleted: store.deleteIntegration(req.params.name) });
});

/**
 * @swagger
 * /admin/api/system/cache:
 *   delete:
 *     summary: Clear cached administrative data
 *     tags: [AdminAPI]
 *     responses:
 *       200:
 *         description: Cache cleared result
 */
router.delete('/system/cache', (req, res) => {
  res.json(store.clearSystemCache());
});

/**
 * @swagger
 * /admin/api/system/sessions/{id}:
 *   delete:
 *     summary: Terminate an administrator session
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/system/sessions/:id', (req, res) => {
  res.json({ deleted: store.deleteSystemSession(req.params.id) });
});

/**
 * @swagger
 * /admin/api/invitations/{id}:
 *   delete:
 *     summary: Delete an invitation record
 *     tags: [AdminAPI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion status
 */
router.delete('/invitations/:id', (req, res) => {
  res.json({ deleted: store.deleteInvitation(req.params.id) });
});

module.exports = router;
