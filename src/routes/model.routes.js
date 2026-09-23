'use strict';

const { Router } = require('express');
const modelController = require('../controllers/modelController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();

// Health and readiness
router.get('/health', modelController.healthCheck);
router.get('/ready', modelController.readyCheck);

// Term readiness
router.get('/terms/:termId/readiness', authenticate, modelController.checkReadiness);

// Solve timetable (generates and persists draft)
router.post('/solve', authenticate, modelController.solveTimetable);

// Solver results
router.get('/solver/summary', authenticate, modelController.getSolverSummary);
router.get('/solver/scheduled', authenticate, modelController.getScheduledSessions);
router.get('/solver/unscheduled', authenticate, modelController.getUnscheduledSessions);

// Validation endpoints
router.post('/validate-proposal', authenticate, modelController.validateProposal);
router.post('/validate-change', authenticate, modelController.validateChange);

// Scheduler workflow: submit draft for review
router.post(
  '/schedule-versions/:versionId/submit-review',
  authenticate,
  authorize(ROLES.SCHEDULER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  modelController.submitForReview
);

// Admin workflow: review, edit, revalidate, publish
router.post(
  '/schedule-versions/:versionId/review',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  modelController.reviewDraft
);

router.patch(
  '/schedule-versions/:versionId',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  modelController.updateDraft
);

router.post(
  '/schedule-versions/:versionId/revalidate',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  modelController.revalidateDraft
);

router.post(
  '/schedule-versions/:versionId/publish',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  modelController.publishDraft
);

module.exports = router;