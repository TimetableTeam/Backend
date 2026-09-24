'use strict';

const { Router } = require('express');
const coursesController = require('../controllers/coursesController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');
const { enforceDepartmentAccessForCourse } = require('../middleware/departmentGrants');

const router = Router();
const manageCourses = authorize(ROLES.DEPARTMENT_COORDINATOR);

router.get('/', authenticate, coursesController.list);
router.get('/:id', authenticate, coursesController.getOne);
router.get('/:id/requirements', authenticate, coursesController.getRequirements);
router.post('/', authenticate, manageCourses, enforceDepartmentAccessForCourse, coursesController.create);

module.exports = router;
