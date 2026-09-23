'use strict';

const { Router } = require('express');
const scheduleVersionsController = require('../controllers/scheduleVersionsController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();
const manageVersions = authorize(ROLES.ADMIN, ROLES.SCHEDULER);
const publishVersions = authorize(ROLES.ADMIN, ROLES.SCHEDULER);
const staffOnly = authorize(ROLES.ADMIN, ROLES.SCHEDULER, ROLES.DEPARTMENT_COORDINATOR, ROLES.LAB_MANAGER, ROLES.LECTURER, ROLES.TA);

router.get('/', authenticate, staffOnly, scheduleVersionsController.list);
router.get('/published', authenticate, scheduleVersionsController.getPublished);
router.get('/:id', authenticate, staffOnly, scheduleVersionsController.getOne);
router.post('/', authenticate, manageVersions, scheduleVersionsController.create);
router.get('/:id/validate', authenticate, staffOnly, scheduleVersionsController.validate);
router.post('/:id/publish', authenticate, publishVersions, scheduleVersionsController.publish);

module.exports = router;
