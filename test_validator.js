const { resetPasswordSchema } = require('./src/validators/authValidators');

// Mock Express request
const req = {
  body: {
    token: '55a4a315cfe673a354ae20e2eb1c7cee43d81a57e5b83da63b262df45f4f5cd3',
    password: 'NewPass123!',
    confirmPassword: 'NewPass123!'
  }
};

const res = {};
const next = (err) => {
  if (err) {
    console.log('Validator error:', err);
    console.log('Error message:', err.message);
    console.log('Error status:', err.status);
    console.log('Error extra:', err.extra);
  } else {
    console.log('Validator passed');
  }
};

resetPasswordSchema(req, res, next);