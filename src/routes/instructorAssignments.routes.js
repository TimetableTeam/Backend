'use strict';

const { Router } = require('express');
const instructorAssignmentsController = require('../controllers/instructorAssignmentsController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, instructorAssignmentsController.list);

module.exports = router;
