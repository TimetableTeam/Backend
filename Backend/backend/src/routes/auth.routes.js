'use strict';

const { Router } = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');
const { loginSchema, otpSchema } = require('../validators/authValidators');
const { validateBody, required, isEmail, isOneOf, all } = require('../validators/validate');

const router = Router();

router.post('/login', loginSchema, authController.login);
router.post('/verify-otp', otpSchema, authController.verifyOtp);
router.get('/me', authenticate, authController.me);

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
  authController.adminCreateAccount
);

module.exports = router;
