'use strict';

const { withTransaction, query } = require('../db/pool');
const conflictService = require('./conflictService');
const allocationsRepo = require('../repositories/allocationsRepo');
const timeSlotsRepo = require('../repositories/timeSlotsRepo');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const auditRepo = require('../repositories/auditRepo');
const ApiError = require('../utils/ApiError');

/** Read-only conflict check, used by both the "check" endpoint and create/update. */
async function checkConflicts({ termId, versionId, sectionId, requirementId, instructorId, roomId, weekday, start, excludeAllocationId }) {
  return conflictService.buildAndEvaluateCandidate({ termId, versionId, sectionId, requirementId, instructorId, roomId, weekday, start, excludeAllocationId });
}

async function assertVersionIsDraft(versionId) {
  const version = await scheduleVersionsRepo.findById(versionId);
  if (!version) throw ApiError.notFound('Schedule version not found.');
  if (version.state !== 'DRAFT') {
    throw ApiError.conflict(`Schedule version is ${version.state}; only DRAFT versions can be edited.`);
  }
  return version;
}

async function createAllocation({ versionId, sectionId, requirementId, instructorId, roomId, weekday, start, actor }) {
  const version = await assertVersionIsDraft(versionId);
  const termId = version.term_id;

  const { result, resolved } = await checkConflicts({ termId, versionId, sectionId, requirementId, instructorId, roomId, weekday, start });
  if (!result.feasible) {
    throw ApiError.conflict('Allocation conflicts detected', { conflicts: result.conflicts });
  }

  const startSlot = resolved.startTimeSlot || (await timeSlotsRepo.findByTermWeekdayStart(termId, weekday, start));
  if (!startSlot) {
    throw ApiError.badRequest('No matching time slot exists for this weekday/start time in this term.');
  }
  const endsAt = resolved.end;

  const allocation = await withTransaction(async (client) => {
    return allocationsRepo.create(client, {
      termId,
      versionId,
      sectionId,
      requirementId,
      instructorId,
      roomId,
      startSlotId: startSlot.id,
      endsAt,
      createdBy: actor.id,
    });
  });

  await auditRepo.record({
    actorAccountId: actor.id,
    actorEmail: actor.email,
    action: 'ALLOCATION_CREATED',
    entityType: 'allocations',
    entityId: allocation.id,
    outcome: 'SUCCESS',
    details: { versionId, sectionId, requirementId, instructorId, roomId, weekday, start },
  });

  return allocation;
}

async function updateAllocation({ allocationId, roomId, weekday, start, instructorId, actor }) {
  const existing = await allocationsRepo.findById(allocationId);
  if (!existing) throw ApiError.notFound('Allocation not found.');

  const version = await assertVersionIsDraft(existing.version_id);
  const termId = version.term_id;

  const finalInstructorId = instructorId ?? existing.instructor_id;
  const finalRoomId = roomId ?? existing.room_id;

  const { result, resolved } = await checkConflicts({
    termId,
    versionId: existing.version_id,
    sectionId: existing.section_id,
    requirementId: existing.requirement_id,
    instructorId: finalInstructorId,
    roomId: finalRoomId,
    weekday,
    start,
    excludeAllocationId: allocationId,
  });
  if (!result.feasible) {
    throw ApiError.conflict('Allocation conflicts detected', { conflicts: result.conflicts });
  }

  const startSlot = resolved.startTimeSlot || (await timeSlotsRepo.findByTermWeekdayStart(termId, weekday, start));
  if (!startSlot) throw ApiError.badRequest('No matching time slot exists for this weekday/start time in this term.');

  const updated = await withTransaction(async (client) => {
    return allocationsRepo.update(client, allocationId, {
      roomId: finalRoomId,
      startSlotId: startSlot.id,
      endsAt: resolved.end,
      instructorId: finalInstructorId,
      updatedBy: actor.id,
    });
  });

  await auditRepo.record({
    actorAccountId: actor.id,
    actorEmail: actor.email,
    action: 'ALLOCATION_UPDATED',
    entityType: 'allocations',
    entityId: allocationId,
    outcome: 'SUCCESS',
    details: { roomId: finalRoomId, weekday, start, instructorId: finalInstructorId },
  });

  return updated;
}

async function deleteAllocation({ allocationId, actor }) {
  const existing = await allocationsRepo.findById(allocationId);
  if (!existing) throw ApiError.notFound('Allocation not found.');
  await assertVersionIsDraft(existing.version_id);

  const deleted = await allocationsRepo.remove(allocationId);
  await auditRepo.record({
    actorAccountId: actor.id,
    actorEmail: actor.email,
    action: 'ALLOCATION_DELETED',
    entityType: 'allocations',
    entityId: allocationId,
    outcome: deleted ? 'SUCCESS' : 'FAILURE',
  });
  return deleted;
}

async function listByVersion(versionId) {
  return allocationsRepo.listByVersion(versionId);
}

module.exports = { checkConflicts, createAllocation, updateAllocation, deleteAllocation, listByVersion };
