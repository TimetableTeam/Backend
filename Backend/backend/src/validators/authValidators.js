'use strict';

const { validateBody, required, isEmail, all } = require('./validate');

const loginSchema = validateBody({
  email: all(required('Email'), isEmail('Email')),
  password: required('Password'),
});

const otpSchema = validateBody({
  email: all(required('Email'), isEmail('Email')),
  code: required('Code'),
  challengeId: required('challengeId'),
});

module.exports = { loginSchema, otpSchema };
