const crypto = require('crypto');
const token = '55a4a315cfe673a354ae20e2eb1c7cee43d81a57e5b83da63b262df45f4f5cd3';
const hash = crypto.createHash('sha256').update(token).digest('hex');
console.log('Token hash:', hash);
console.log('DB hash:', 'ea98f9c67d493f08298640f9e0ef056ee5a2b1039f857f60f9d43a6fe0412200');
console.log('Match:', hash === 'ea98f9c67d493f08298640f9e0ef056ee5a2b1039f857f60f9d43a6fe0412200');