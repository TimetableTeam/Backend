'use strict';

const { Router } = require('express');
const termsController = require('../controllers/termsController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, termsController.list);
router.get('/active', authenticate, termsController.getActive);

module.exports = router;
