'use strict';

const { Router } = require('express');
const departmentsController = require('../controllers/departmentsController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, departmentsController.list);

module.exports = router;
