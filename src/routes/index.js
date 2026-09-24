'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');
const dashboardController = require('../controllers/dashboardController');

const router = Router();

router.use('/health', require('./health.routes'));
// Frozen frontend contract compatibility layer. Keep this before the native routers.
router.use('/', require('./frontendCompat.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/departments', require('./departments.routes'));
router.use('/terms', require('./terms.routes'));
router.use('/rooms', require('./rooms.routes'));
router.use('/staff', require('./staff.routes'));
router.use('/courses', require('./courses.routes'));
router.use('/sections', require('./sections.routes'));
router.use('/student-groups', require('./studentGroups.routes'));
router.use('/students', require('./students.routes'));
router.use('/timeslots', require('./timeSlots.routes'));
router.use('/schedule-versions', require('./scheduleVersions.routes'));
router.use('/allocations', require('./allocations.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/calendar', require('./calendar.routes'));
router.use('/model', require('./model.routes'));
router.use('/change-notifications', require('./changeNotifications.routes'));
router.use('/master-data', require('./masterData.routes'));
router.use('/requirements', require('./requirements.routes'));
router.use('/instructor-assignments', require('./instructorAssignments.routes'));
router.use('/catalog', require('./catalog.routes'));
router.use('/schedule/drafts', require('./scheduleDrafts.routes'));
router.use('/admin', require('./admin.routes'));
module.exports = router;
