'use strict';

const { Router } = require('express');
const staffController = require('../controllers/staffController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, staffController.list);
router.get('/:id/availability', authenticate, staffController.getAvailability);

module.exports = router;
