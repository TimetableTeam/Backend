'use strict';

const { Router } = require('express');
const timeSlotsController = require('../controllers/timeSlotsController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, timeSlotsController.list);

module.exports = router;
