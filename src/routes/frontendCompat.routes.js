'use strict';

const { Router } = require('express');
const c = require('../controllers/frontendCompatController');
const roomsController = require('../controllers/roomsController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();

const superAdmin = authorize(ROLES.SUPER_ADMIN);
const coordinator = authorize(ROLES.DEPARTMENT_COORDINATOR);
const scheduler = authorize(ROLES.SCHEDULER);
const schedulerOrAdmin = authorize(ROLES.SCHEDULER, ROLES.ADMIN);
const admin = authorize(ROLES.ADMIN);
const labManager = authorize(ROLES.LAB_MANAGER);
const lecturerOrTa = authorize(ROLES.LECTURER, ROLES.TA);
const registrar = authorize(ROLES.REGISTRATION_OFFICER);

// Fixed /master-data/terms routes do not populate req.params.type like the
// generic /master-data/:type routes do. Bind the type explicitly before
// delegating to the shared master-data controllers.
const asMasterDataType = (type, handler) => (req, res, next) => {
  req.params.type = type;
  return handler(req, res, next);
};

// Auth/profile contract frozen by frontend.
router.post('/auth/forgot-password', c.forgotPassword);
router.post('/auth/reset-password', c.resetPassword);
router.get('/auth/me', authenticate, c.getMyProfile);
router.patch('/auth/me', authenticate, c.updateMyProfile);
router.post('/auth/change-password', authenticate, c.changeMyPassword);

// Role-aware workspace summary and audit.
router.get('/overview', authenticate, c.overview);
router.get('/audit-log', authenticate, superAdmin, c.auditLog);
router.get('/catalog/planning', authenticate, c.planningCatalog);

// Departments: frontend expects full Super Admin CRUD.
router.get('/departments', authenticate, c.getDepartmentsCompat);
router.post('/departments', authenticate, superAdmin, c.createDepartment);
router.patch('/departments/:id', authenticate, superAdmin, c.updateDepartment);
router.delete('/departments/:id', authenticate, superAdmin, c.deleteDepartment);

// Legacy master-data facade used by the current React screen.
router.get('/master-data/:type', authenticate, c.getMasterData);
// Academic Terms are university-wide setup and are Super Admin-only.
router.post('/master-data/terms', authenticate, superAdmin, asMasterDataType('terms', c.createMasterData));
router.put('/master-data/terms/:id', authenticate, superAdmin, asMasterDataType('terms', c.updateMasterData));
router.post('/master-data/terms/:id/end', authenticate, superAdmin, c.endAcademicTerm);
router.delete('/master-data/terms/:id', authenticate, superAdmin, asMasterDataType('terms', c.deleteMasterData));
// Time-slot templates are active-term setup and are Super Admin-only.
router.post('/master-data/slots', authenticate, superAdmin, asMasterDataType('slots', c.createMasterData));
// Courses/Sections remain Department Coordinator-owned (Super Admin bypasses authorize()).
router.post('/master-data/:type', authenticate, coordinator, c.createMasterData);
router.put('/master-data/:type/:id', authenticate, coordinator, c.updateMasterData);
router.delete('/master-data/:type/:id', authenticate, coordinator, c.deleteMasterData);

// Requirements and instructor assignments belong to Coordinator.
router.get('/requirements', authenticate, c.getRequirements);
router.get('/instructor-assignments', authenticate, c.getInstructorAssignments);
router.post('/requirements', authenticate, coordinator, c.createRequirement);
router.put('/requirements/:id', authenticate, coordinator, c.updateRequirement);
// Coordinators can extend the equipment vocabulary used by requirement forms.
// Room inventory remains Lab Manager-owned; this only creates a catalog item.
router.post('/equipment', authenticate, coordinator, c.createEquipmentCatalogItem);
router.post('/sections/:id/instructors', authenticate, coordinator, c.assignInstructor);
router.delete('/sections/:id/instructors/:staffId', authenticate, coordinator, c.removeInstructor);

// Availability belongs to Lecturer / TA.
router.get('/availability/me', authenticate, lecturerOrTa, c.getMyAvailability);
router.put('/availability/me', authenticate, lecturerOrTa, c.saveMyAvailability);
router.post('/availability/me/confirm', authenticate, lecturerOrTa, c.confirmMyAvailability);

// Rooms are readable by authenticated users; writes belong to Lab Manager.
router.get('/rooms', authenticate, c.getRoomsCompat);
router.post('/rooms', authenticate, labManager, c.createRoomCompat);

// Lab Manager compatibility endpoints.
router.get('/lab-checks', authenticate, labManager, c.getLabChecks);
router.post('/lab-checks/:requirementId', authenticate, labManager, c.saveLabCheck);
router.put('/rooms/:id', authenticate, labManager, c.updateRoomCompat);
router.delete('/rooms/:id', authenticate, labManager, c.deleteRoom);

// Frozen frontend schedule/draft facade. Internally uses schedule_versions + allocations.
router.get('/schedule/drafts/:draftId/workflow', authenticate, c.getDraftWorkflow);
router.post('/schedule/drafts/:draftId/generate', authenticate, scheduler, c.generateDraft);
router.post('/schedule/drafts/:draftId/submit-review', authenticate, scheduler, c.submitDraftReview);
router.get('/schedule/drafts/:draftId/allocations', authenticate, c.getDraftAllocations);
router.post('/schedule/drafts/:draftId/allocations', authenticate, scheduler, c.createDraftAllocation);
router.put('/schedule/drafts/:draftId/allocations/:allocationId', authenticate, schedulerOrAdmin, c.updateDraftAllocation);
router.delete('/schedule/drafts/:draftId/allocations/:allocationId', authenticate, scheduler, c.deleteDraftAllocation);
router.post('/schedule/drafts/:draftId/validate', authenticate, schedulerOrAdmin, c.validateDraft);
// Final project rule: ADMIN publishes; SCHEDULER cannot publish. SUPER_ADMIN bypass is built into authorize().
router.post('/schedule/drafts/:draftId/publish', authenticate, admin, c.publishDraft);

router.get('/timetable/published/me', authenticate, c.publishedTimetable);

// Registration Officer -> courses; Coordinator -> sections.
router.get('/students', authenticate, authorize(ROLES.REGISTRATION_OFFICER, ROLES.DEPARTMENT_COORDINATOR, ROLES.ADMIN), c.getStudentsCompat);
router.get('/students/:studentId/course-enrollments', authenticate, authorize(ROLES.REGISTRATION_OFFICER, ROLES.DEPARTMENT_COORDINATOR), c.getCourseEnrollments);
router.post('/course-enrollments', authenticate, registrar, c.createCourseEnrollment);
router.delete('/course-enrollments/:id', authenticate, registrar, c.deleteCourseEnrollment);
router.get('/students/:studentId/section-enrollments', authenticate, coordinator, c.getSectionEnrollments);
router.post('/section-enrollments', authenticate, coordinator, c.createSectionEnrollment);
router.delete('/section-enrollments/:id', authenticate, coordinator, c.deleteSectionEnrollment);

// Super Admin account/role builder contract.
router.get('/admin/accounts', authenticate, superAdmin, c.listAdminAccounts);
router.post('/admin/accounts', authenticate, superAdmin, c.createAdminAccount);
router.put('/admin/accounts/:id', authenticate, superAdmin, c.updateAdminAccount);
router.delete('/admin/accounts/:id', authenticate, superAdmin, c.deleteAdminAccount);
router.get('/admin/roles', authenticate, superAdmin, c.listAdminRoles);
router.post('/admin/roles', authenticate, superAdmin, c.createAdminRole);
router.put('/admin/roles/:id', authenticate, superAdmin, c.updateAdminRole);
router.delete('/admin/roles/:id', authenticate, superAdmin, c.deleteAdminRole);

module.exports = router;
