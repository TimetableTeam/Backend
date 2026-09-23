'use strict';

const { Router } = require('express');
const requirementsController = require('../controllers/requirementsController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, requirementsController.list);

module.exports = router;
