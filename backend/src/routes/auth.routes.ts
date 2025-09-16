import { Router } from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/auth.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { RateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('storeId').isUUID()
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('storeId').isUUID()
];

// Public routes
router.post(
  '/register',
  RateLimiter.create({ max: 5, windowMs: 15 * 60 * 1000 }),
  registerValidation,
  AuthController.register
);

router.post(
  '/login',
  RateLimiter.loginLimiter(),
  loginValidation,
  AuthController.login
);

router.post(
  '/refresh',
  RateLimiter.create({ max: 10, windowMs: 15 * 60 * 1000 }),
  body('refreshToken').notEmpty(),
  AuthController.refreshToken
);

// Shopify OAuth routes
router.get(
  '/shopify/install',
  RateLimiter.create({ max: 10, windowMs: 15 * 60 * 1000 }),
  AuthController.shopifyInstall
);

router.get(
  '/shopify/callback',
  RateLimiter.create({ max: 10, windowMs: 15 * 60 * 1000 }),
  AuthController.shopifyCallback
);

// Protected routes
router.post(
  '/logout',
  AuthMiddleware.verifySession,
  AuthController.logout
);

export default router;
