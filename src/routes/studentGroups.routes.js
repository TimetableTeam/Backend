'use strict';

const { Router } = require('express');
const studentGroupsController = require('../controllers/studentGroupsController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();
const manageGroups = authorize(ROLES.ADMIN, ROLES.DEPARTMENT_COORDINATOR, ROLES.SCHEDULER);

router.get('/', authenticate, studentGroupsController.list);
router.post('/', authenticate, manageGroups, studentGroupsController.create);

module.exports = router;
