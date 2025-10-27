const express = require('express');
const { ensureAdmin } = require('../middleware/auth');
const { listUsers, findUserById } = require('../models/userModel');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative features
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List registered users with real identities (admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Admin user list
 */
router.get('/users', ensureAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const { users, total } = await listUsers({ page, limit: 20 });
    res.render('admin/users', { users, total, page });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: View a user's identity (admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User detail
 */
router.get('/users/:id', ensureAdmin, async (req, res, next) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).render('error', { error: new Error('사용자를 찾을 수 없습니다.') });
    }
    res.render('admin/userDetail', { user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
