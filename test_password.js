const { validatePassword } = require('./src/utils/passwordPolicy');
console.log('NewPass123!:', validatePassword('NewPass123!'));
console.log('TestPass123!:', validatePassword('TestPass123!'));
console.log('password123:', validatePassword('password123'));