'use strict';

const { withTransaction } = require('../db/pool');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const allocationsRepo = require('../repositories/allocationsRepo');
const conflictService = require('./conflictService');
const auditRepo = require('../repositories/auditRepo');
const ApiError = require('../utils/ApiError');

async function createDraft({ termId, name, actor }) {
  const draft = await scheduleVersionsRepo.createDraft({ termId, name, createdBy: actor.id });
  await auditRepo.record({ actorAccountId: actor.id, actorEmail: actor.email, action: 'SCHEDULE_VERSION_CREATED', entityType: 'schedule_versions', entityId: draft.id, outcome: 'SUCCESS' });
  return draft;
}

/**
 * Re-validate every allocation currently in a draft against the full hard
 * conflict engine (fresh data - availability/closures may have changed since
 * each allocation was individually created) and report all violations found.
 */
async function validateVersion(versionId) {
  const version = await scheduleVersionsRepo.findById(versionId);
  if (!version) throw ApiError.notFound('Schedule version not found.');

  const rawAllocations = await allocationsRepo.listForEngine(versionId, null);
  const detailed = await allocationsRepo.listByVersion(versionId); // for section/requirement/instructor/room ids per allocation

  const byId = new Map(detailed.map((d) => [d.id, d]));

  const violations = [];
  for (const alloc of rawAllocations) {
    const detail = byId.get(alloc.id);
    if (!detail) continue;
    const { result } = await conflictService.buildAndEvaluateCandidate({
      termId: version.term_id,
      versionId,
      sectionId: detail.section_id,
      requirementId: detail.requirement_id,
      instructorId: alloc.instructorId,
      roomId: alloc.roomId,
      weekday: alloc.weekday,
      start: alloc.start,
      excludeAllocationId: alloc.id,
    });
    if (!result.feasible) {
      violations.push({ allocationId: alloc.id, sectionCode: detail.section_code, roomCode: detail.room_code, instructorName: detail.instructor_name, conflicts: result.conflicts });
    }
  }

  return { valid: violations.length === 0, violations, allocationCount: rawAllocations.length };
}

async function publishVersion({ versionId, actor }) {
  const version = await scheduleVersionsRepo.findById(versionId);
  if (!version) throw ApiError.notFound('Schedule version not found.');
  if (version.state !== 'DRAFT') {
    throw ApiError.conflict(`Only DRAFT versions can be published; this version is ${version.state}.`);
  }

  const validation = await validateVersion(versionId);
  if (!validation.valid) {
    await auditRepo.record({
      actorAccountId: actor.id,
      actorEmail: actor.email,
      action: 'SCHEDULE_PUBLISH_REJECTED',
      entityType: 'schedule_versions',
      entityId: versionId,
      outcome: 'FAILURE',
      details: { violationCount: validation.violations.length },
    });
    throw ApiError.conflict('Cannot publish: hard conflicts exist in this schedule.', { violations: validation.violations });
  }

  const published = await withTransaction((client) => scheduleVersionsRepo.publish(client, versionId, actor.id));

  await auditRepo.record({
    actorAccountId: actor.id,
    actorEmail: actor.email,
    action: 'SCHEDULE_PUBLISHED',
    entityType: 'schedule_versions',
    entityId: versionId,
    outcome: 'SUCCESS',
  });

  return published;
}

async function listVersions(termId) {
  return scheduleVersionsRepo.listByTerm(termId);
}

async function getPublished(termId) {
  return scheduleVersionsRepo.findPublished(termId);
}

module.exports = { createDraft, validateVersion, publishVersion, listVersions, getPublished };
