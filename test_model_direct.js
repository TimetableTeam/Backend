require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const modelService = require('./src/services/modelService');

async function test() {
  try {
    // Mock actor (super admin)
    const actor = { id: 19, email: 'engramzy9@gmail.com' };
    const result = await modelService.solveAndPersistTimetable(1, actor);
    console.log('SUCCESS:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
  }
}

test();