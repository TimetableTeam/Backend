'use strict';

const { Router } = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();
const staffOnly = authorize(ROLES.ADMIN, ROLES.SCHEDULER, ROLES.DEPARTMENT_COORDINATOR, ROLES.LAB_MANAGER, ROLES.LECTURER, ROLES.TA);

router.get('/summary', authenticate, staffOnly, dashboardController.getSummary);

module.exports = router;
