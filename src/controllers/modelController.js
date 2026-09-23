'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok } = require('../utils/apiResponse');
const modelService = require('../services/modelService');
const scheduleWorkflowService = require('../services/scheduleWorkflowService');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const ApiError = require('../utils/ApiError');

const checkReadiness = asyncHandler(async (req, res) => {
  const { termId } = req.params;
  const result = await modelService.checkTermReadiness(termId);
  return ok(res, result);
});

const solveTimetable = asyncHandler(async (req, res) => {
  const { termId } = req.body;
  if (!termId) throw ApiError.badRequest('termId is required');

  // First check readiness
  const readiness = await modelService.checkTermReadiness(termId);
  if (!readiness.ready) {
    return res.status(422).json({
      success: false,
      message: 'Term is not ready for scheduling',
      data: { term_id: Number(termId), ready: false, errors: readiness.errors },
    });
  }

  const result = await modelService.solveAndPersistTimetable(termId, req.user);
  return ok(res, result);
});

const getSolverSummary = asyncHandler(async (req, res) => {
  const result = await modelService.getSolverSummary();
  return ok(res, result);
});

const getScheduledSessions = asyncHandler(async (req, res) => {
  const result = await modelService.getScheduledSessions();
  return ok(res, result);
});

const getUnscheduledSessions = asyncHandler(async (req, res) => {
  const result = await modelService.getUnscheduledSessions();
  return ok(res, result);
});

const validateProposal = asyncHandler(async (req, res) => {
  const { sectionId, instructorId, roomId, slotId, eventDate } = req.body;
  if (!sectionId || !instructorId || !roomId || !slotId || !eventDate) {
    throw ApiError.badRequest('sectionId, instructorId, roomId, slotId, and eventDate are required');
  }
  const result = await modelService.validateProposal({
    section_id: sectionId,
    instructor_id: instructorId,
    room_id: roomId,
    slot_id: slotId,
    event_date: eventDate,
  });
  return ok(res, result);
});

const validateChange = asyncHandler(async (req, res) => {
  const { allocationId, sessionDate, proposedRoomId, proposedInstructorId, proposedStartSlotId } = req.body;
  if (!allocationId || !sessionDate) {
    throw ApiError.badRequest('allocationId and sessionDate are required');
  }
  const result = await modelService.validateChange({
    allocation_id: allocationId,
    session_date: sessionDate,
    proposed_room_id: proposedRoomId,
    proposed_instructor_id: proposedInstructorId,
    proposed_start_slot_id: proposedStartSlotId,
  });
  return ok(res, result);
});

const healthCheck = asyncHandler(async (req, res) => {
  const result = await modelService.health();
  return ok(res, result);
});

const readyCheck = asyncHandler(async (req, res) => {
  const result = await modelService.ready();
  return ok(res, result);
});

// Scheduler: Submit draft for admin review
const submitForReview = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const { resolvedConflictIds } = req.body || {};

  const validation = await scheduleWorkflowService.validateDraft(versionId, resolvedConflictIds);
  if (!validation.valid) {
    throw ApiError.conflict('Cannot submit for review: hard conflicts exist', {
      violations: validation.conflicts,
    });
  }

  const workflow = await scheduleWorkflowService.submitForReview(versionId, req.user.id, resolvedConflictIds);
  return ok(res, workflow);
});

// Admin: Review draft
const reviewDraft = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const draft = await scheduleWorkflowService.getDraftForReview(versionId);
  return ok(res, draft);
});

// Admin: Update draft allocation
const updateDraft = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const { allocationId, roomId, instructorId, weekday, start } = req.body;

  const updated = await scheduleWorkflowService.updateDraftAllocation(versionId, allocationId, {
    roomId,
    instructorId,
    weekday,
    start,
  }, req.user);

  return ok(res, updated);
});

// Admin: Revalidate draft
const revalidateDraft = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const validation = await scheduleWorkflowService.validateDraft(versionId);
  return ok(res, validation);
});

// Admin: Publish draft
const publishDraft = asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const { term_id, name, published_by } = req.body;

  const published = await scheduleWorkflowService.publishDraft(versionId, req.user.id);
  return ok(res, published);
});

module.exports = {
  checkReadiness,
  solveTimetable,
  getSolverSummary,
  getScheduledSessions,
  getUnscheduledSessions,
  validateProposal,
  validateChange,
  healthCheck,
  readyCheck,
  submitForReview,
  reviewDraft,
  updateDraft,
  revalidateDraft,
  publishDraft,
};