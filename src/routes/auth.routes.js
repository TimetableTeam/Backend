
'use strict';

const { Router } = require('express');

const authController = require('../controllers/authController');
const authService = require('../services/authService');

const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const {
  loginSchema,
  otpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  transferSuperAdminSchema
} = require('../validators/authValidators');

const {
  validateBody,
  required,
  isEmail,
  isOneOf,
  all
} = require('../validators/validate');

const router = Router();

router.post('/login', loginSchema, authController.login);

router.post('/verify-otp', otpSchema, authService.verifyOtp);

router.get('/me', authenticate, authService.me);

// Password reset (public endpoints)
router.post(
  '/forgot-password',
  forgotPasswordSchema,
  authController.requestPasswordReset
);

router.post(
  '/reset-password',
  resetPasswordSchema,
  authController.resetPassword
);

router.get(
  '/verify-reset-token',
  authController.verifyResetToken
);

const createAccountSchema = validateBody({
  email: all(required('Email'), isEmail('Email')),
  fullName: required('fullName'),
  role: all(required('role'), isOneOf(Object.values(ROLES), 'role')),
  initialPassword: required('initialPassword'),
});

router.post(
  '/admin-create-account',
  authenticate,
  authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  createAccountSchema,
  authService.adminCreateAccount
);

router.post(
  '/transfer-super-admin',
  authenticate,
  authorize(ROLES.SUPER_ADMIN),
  transferSuperAdminSchema,
  authController.transferSuperAdmin
);

module.exports = router;

