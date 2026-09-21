'use strict';

const { Router } = require('express');
const coursesController = require('../controllers/coursesController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();
const manageCourses = authorize(ROLES.ADMIN, ROLES.DEPARTMENT_COORDINATOR, ROLES.SCHEDULER);

router.get('/', authenticate, coursesController.list);
router.get('/:id', authenticate, coursesController.getOne);
router.get('/:id/requirements', authenticate, coursesController.getRequirements);
router.post('/', authenticate, manageCourses, coursesController.create);

module.exports = router;
