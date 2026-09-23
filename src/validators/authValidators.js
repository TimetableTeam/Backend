'use strict';

const { validateBody, required, isEmail, all, minLength, maxLength } = require('./validate');

const loginSchema = validateBody({
  email: all(required('Email'), isEmail('Email')),
  password: required('Password'),
});

const otpSchema = validateBody({
  email: all(required('Email'), isEmail('Email')),
  code: required('Code'),
  challengeId: required('challengeId'),
});

const forgotPasswordSchema = validateBody({
  email: all(required('Email'), isEmail('Email')),
});

const resetPasswordSchema = validateBody({
  token: required('Token'),
  password: all(required('Password'), minLength(8), maxLength(128)),
  confirmPassword: required('Confirm Password'),
});

const transferSuperAdminSchema = validateBody({
  newSuperAdminEmail: all(required('newSuperAdminEmail'), isEmail('newSuperAdminEmail')),
  newSuperAdminPassword: all(required('newSuperAdminPassword'), minLength(8), maxLength(128)),
});

module.exports = { loginSchema, otpSchema, forgotPasswordSchema, resetPasswordSchema, transferSuperAdminSchema };
