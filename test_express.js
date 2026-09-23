const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.post('/test', (req, res) => {
  console.log('Body:', req.body);
  console.log('Content-Type:', req.headers['content-type']);
  res.json({ success: true, body: req.body });
});

app.listen(3001, () => {
  console.log('Test server on port 3001');
});