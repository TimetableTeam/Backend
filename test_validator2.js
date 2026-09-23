const { resetPasswordSchema } = require('./src/validators/authValidators');

const testCases = [
  {
    token: '55a4a315cfe673a354ae20e2eb1c7cee43d81a57e5b83da63b262df45f4f5cd3',
    password: 'NewPass123!',
    confirmPassword: 'NewPass123!'
  },
  {
    token: '55a4a315cfe673a354ae20e2eb1c7cee43d81a57e5b83da63b262df45f4f5cd3',
    password: 'NewPass123!',
    confirmPassword: 'DifferentPass123!'
  },
  {
    token: '',
    password: 'NewPass123!',
    confirmPassword: 'NewPass123!'
  },
  {
    token: '55a4a315cfe673a354ae20e2eb1c7cee43d81a57e5b83da63b262df45f4f5cd3',
    password: 'short',
    confirmPassword: 'short'
  }
];

for (const testCase of testCases) {
  console.log('\nTest case:', JSON.stringify(testCase));
  
  const req = { body: testCase };
  const res = {};
  const next = (err) => {
    if (err) {
      console.log('  Error:', err.message);
      console.log('  Status:', err.status);
      console.log('  Extra:', err.extra);
    } else {
      console.log('  Passed');
    }
  };
  
  // Import the validator middleware
  const { resetPasswordSchema } = require('./src/validators/authValidators');
  resetPasswordSchema(req, {}, next);
}