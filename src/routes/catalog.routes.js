'use strict';

const { Router } = require('express');
const catalogController = require('../controllers/catalogController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.get('/planning', authenticate, catalogController.getPlanning);

module.exports = router;
