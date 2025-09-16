const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { rateLimitAuth } = require('../middleware/rateLimiter');

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Routes
router.post('/register', rateLimitAuth, validateRegistration, authController.register);
router.post('/login', rateLimitAuth, validateLogin, authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refreshToken);
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/forgot-password', rateLimitAuth, authController.forgotPassword);
router.post('/reset-password', rateLimitAuth, authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', rateLimitAuth, authController.resendVerification);
router.put('/update-profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);
router.get('/sessions', authenticate, authController.getActiveSessions);
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);

module.exports = router;
