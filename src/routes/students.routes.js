'use strict';

const { Router } = require('express');
const studentsController = require('../controllers/studentsController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();

// Student self-service endpoints
router.get('/me', authenticate, authorize(ROLES.STUDENT), studentsController.getMyProfile);
router.get('/me/registrations', authenticate, authorize(ROLES.STUDENT), studentsController.getMyRegistrations);
router.get('/me/enrollments', authenticate, authorize(ROLES.STUDENT), studentsController.getMyEnrollments);
router.get('/me/timetable', authenticate, authorize(ROLES.STUDENT), studentsController.getMyTimetable);

// Admin/Coordinator endpoints
router.get('/', authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.DEPARTMENT_COORDINATOR, ROLES.REGISTRATION_OFFICER), studentsController.listStudents);
router.get('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.DEPARTMENT_COORDINATOR, ROLES.REGISTRATION_OFFICER), studentsController.getStudent);

// REGISTRATION_OFFICER can create students
const manageStudents = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.REGISTRATION_OFFICER);
router.post('/', authenticate, manageStudents, studentsController.createStudent);

module.exports = router;