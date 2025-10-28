const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { createUser, findUserByEmail, findUserById } = require('../models/userModel');
const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication
 */

/**
 * @swagger
 * /register:
 *   get:
 *     summary: Render the registration form
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: HTML form
 */
router.get('/register', (req, res) => {
  res.render('auth/register');
});

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, realName, studentId]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               realName:
 *                 type: string
 *               studentId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error
 */
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('유효한 이메일을 입력하세요.'),
    body('password').isLength({ min: 8 }).withMessage('비밀번호는 최소 8자 이상이어야 합니다.'),
    body('realName').notEmpty().withMessage('이름은 필수입니다.'),
    body('studentId').notEmpty().withMessage('학번은 필수입니다.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach((e) => req.flash('error', e.msg));
      return res.status(400).format({
        html: () => res.redirect('/register'),
        json: () => res.json({ errors: errors.array() })
      });
    }
    try {
      const { email, password, realName, studentId } = req.body;
      const existing = await findUserByEmail(email);
      if (existing) {
        req.flash('error', '이미 사용 중인 이메일입니다.');
        return res.status(400).format({
          html: () => res.redirect('/register'),
          json: () => res.json({ message: 'Email already in use' })
        });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await createUser({ email, passwordHash, realName, studentId });
      req.session.user = {
        id: user.id,
        email,
        nickname: user.nickname,
        reputationScore: 5,
        reputationCount: 0,
        isAdmin: false
      };
      req.flash('success', '회원가입이 완료되었습니다.');
      return res.status(201).format({
        html: () => res.redirect('/auctions'),
        json: () => res.json({ message: 'User created', user: req.session.user })
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /login:
 *   get:
 *     summary: Render the login form
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: HTML form
 */
router.get('/login', (req, res) => {
  res.render('auth/login');
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged in
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('유효한 이메일을 입력하세요.'),
    body('password').notEmpty().withMessage('비밀번호를 입력하세요.')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach((e) => req.flash('error', e.msg));
      return res.status(400).format({
        html: () => res.redirect('/login'),
        json: () => res.json({ errors: errors.array() })
      });
    }
    try {
      const { email, password } = req.body;
      const user = await findUserByEmail(email);
      if (!user) {
        req.flash('error', '이메일 또는 비밀번호가 올바르지 않습니다.');
        return res.status(401).format({
          html: () => res.redirect('/login'),
          json: () => res.json({ message: 'Invalid credentials' })
        });
      }
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        req.flash('error', '이메일 또는 비밀번호가 올바르지 않습니다.');
        return res.status(401).format({
          html: () => res.redirect('/login'),
          json: () => res.json({ message: 'Invalid credentials' })
        });
      }
      req.session.user = {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        reputationScore: Number(user.reputation_score),
        reputationCount: user.reputation_count,
        isAdmin: !!user.is_admin
      };
      req.flash('success', '로그인되었습니다.');
      return res.status(200).format({
        html: () => res.redirect('/auctions'),
        json: () => res.json({ message: 'Logged in', user: req.session.user })
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Logout current user
 *     tags: [Auth]
 *     responses:
 *       204:
 *         description: Logged out
 */
function destroySession(req, res) {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    if (req.xhr || req.originalUrl.startsWith('/api')) {
      return res.status(204).end();
    }
    res.redirect('/');
  });
}

router.post('/logout', destroySession);
router.get('/logout', destroySession);

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: View authenticated user profile
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Profile page
 */
router.get('/profile', ensureAuthenticated, async (req, res, next) => {
  try {
    const user = await findUserById(req.session.user.id);
    res.render('auth/profile', { user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
