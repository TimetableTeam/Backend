'use strict';

const { Router } = require('express');
const sectionsController = require('../controllers/sectionsController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();
const manageSections = authorize(ROLES.DEPARTMENT_COORDINATOR);

router.get('/', authenticate, sectionsController.list);
router.get('/:id', authenticate, sectionsController.getOne);
router.get('/:id/instructors', authenticate, sectionsController.getInstructors);
router.post('/', authenticate, manageSections, sectionsController.create);

module.exports = router;
