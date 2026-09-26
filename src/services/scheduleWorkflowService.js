'use strict';

const { withTransaction } = require('../db/pool');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const allocationsRepo = require('../repositories/allocationsRepo');
const allocationService = require('./allocationService');
const auditRepo = require('../repositories/auditRepo');
const ApiError = require('../utils/ApiError');

/**
 * Validate a draft schedule version by checking all allocations for conflicts
 */
async function validateDraft(versionId, resolvedConflictIds = []) {
  const version = await scheduleVersionsRepo.findById(versionId);
  if (!version) throw ApiError.notFound('Schedule version not found.');

  if (version.state !== 'DRAFT') {
    throw ApiError.badRequest('Only DRAFT versions can be validated.');
  }

  const allocations = await allocationsRepo.listByVersion(versionId);
  
  // Check each allocation for conflicts
  let hasHardConflicts = false;
  const conflicts = [];
  const warnings = [];

  for (const alloc of allocations) {
    const result = await allocationService.checkConflicts({
      termId: version.term_id,
      versionId: version.id,
      sectionId: alloc.section_id,
      requirementId: alloc.requirement_id,
      instructorId: alloc.instructor_id,
      roomId: alloc.room_id,
      weekday: alloc.weekday,
      start: alloc.start,
      excludeAllocationId: alloc.id,
    });

    if (!result.feasible) {
      hasHardConflicts = true;
      conflicts.push({
        allocationId: alloc.id,
        sectionId: alloc.section_id,
        sectionCode: alloc.section_code,
        conflicts: result.conflicts,
      });
    } else if (result.warnings && result.warnings.length > 0) {
      warnings.push({
        allocationId: alloc.id,
        sectionId: alloc.section_id,
        sectionCode: alloc.section_code,
        warnings: result.warnings,
      });
    }
  }

  // Check for unscheduled sections
  const scheduledSectionIds = new Set(allocations.map(a => a.section_id));
  // This would need all sections for the term - for now we just report what's scheduled

  return {
    valid: !hasHardConflicts,
    versionId: version.id,
    versionNumber: version.version_number,
    scheduledCount: allocations.length,
    unscheduledCount: 0, // Would need all sections to calculate
    conflicts,
    warnings,
    message: hasHardConflicts 
      ? 'Draft has hard conflicts that block publication' 
      : 'Draft is valid and ready for review',
  };
}

/**
 * Get draft for review with full details
 */
async function getDraftForReview(versionId) {
  const version = await scheduleVersionsRepo.findById(versionId);
  if (!version) throw ApiError.notFound('Schedule version not found.');

  const allocations = await allocationsRepo.listByVersion(versionId);
  const validation = await validateDraft(versionId);

  return {
    version,
    allocations,
    validation,
  };
}

/**
 * Submit draft for admin review (Scheduler workflow)
 */
async function submitForReview(versionId, actorId, resolvedConflictIds = []) {
  const validation = await validateDraft(versionId, resolvedConflictIds);
  
  if (!validation.valid) {
    throw ApiError.conflict('Cannot submit for review: hard conflicts exist', {
      violations: validation.conflicts,
    });
  }

  // Update version state to SUBMITTED_FOR_REVIEW (or keep as DRAFT with a flag)
  // For now, we just record the submission in audit log
  await auditRepo.record({
    actorAccountId: actorId,
    actorEmail: '', // Would need to fetch
    action: 'SCHEDULE_VERSION_SUBMITTED_FOR_REVIEW',
    entityType: 'schedule_versions',
    entityId: versionId,
    outcome: 'SUCCESS',
    details: {
      resolvedConflictIds,
      scheduledCount: validation.scheduledCount,
      score: validation.score || null,
    },
  });

  return {
    success: true,
    versionId,
    status: 'SUBMITTED_FOR_REVIEW',
    message: 'Draft submitted for admin review',
    validatedAt: new Date().toISOString(),
  };
}

/**
 * Update draft allocation (Admin workflow)
 */
async function updateDraftAllocation(versionId, allocationId, updates, actor) {
  const version = await scheduleVersionsRepo.findById(versionId);
  if (!version) throw ApiError.notFound('Schedule version not found.');
  
  if (version.state !== 'DRAFT' && version.state !== 'SUBMITTED_FOR_REVIEW') {
    throw ApiError.badRequest('Only DRAFT or SUBMITTED_FOR_REVIEW versions can be edited.');
  }

  const updated = await allocationService.updateAllocation({
    allocationId: Number(allocationId),
    roomId: updates.roomId,
    instructorId: updates.instructorId,
    weekday: updates.weekday,
    start: updates.start,
    actor,
  });

  return updated;
}

/**
 * Revalidate draft (Admin workflow)
 */
async function revalidateDraft(versionId) {
  return validateDraft(versionId);
}

/**
 * Publish draft (Admin workflow) - archives previous published, publishes this one
 */
async function publishDraft(versionId, actorId) {
  // Final Tanseek workflow: a Scheduler must submit the draft, then Admin publishes.
  // The DB enum intentionally stays DRAFT/PUBLISHED/ARCHIVED, so review submission
  // is represented by an immutable audit event rather than inventing an unsupported enum value.
  const validation = await validateDraft(versionId);
  if (!validation.valid) {
    throw ApiError.conflict('Cannot publish: hard conflicts exist', { violations: validation.conflicts });
  }
  const review = await require('../db/pool').query(
    `SELECT 1 FROM audit_events
     WHERE entity_type = 'schedule_versions' AND entity_id = $1
       AND action = 'SCHEDULE_VERSION_SUBMITTED_FOR_REVIEW'
       AND outcome = 'SUCCESS'
     ORDER BY occurred_at DESC LIMIT 1`,
    [versionId]
  );
  if (!review.rows.length) {
    throw ApiError.conflict('The Scheduler must submit this draft for Admin review before publishing.');
  }

  return withTransaction(async (client) => {
    const version = await client.query('SELECT * FROM schedule_versions WHERE id = $1 FOR UPDATE', [versionId]);
    if (!version.rows[0]) throw ApiError.notFound('Schedule version not found.');
    
    const v = version.rows[0];
    if (v.state !== 'DRAFT' && v.state !== 'SUBMITTED_FOR_REVIEW') {
      throw ApiError.badRequest('Only DRAFT or SUBMITTED_FOR_REVIEW versions can be published.');
    }

    // Archive previously published version for this term
    await client.query(
      `UPDATE schedule_versions SET state = 'ARCHIVED', updated_at = now() WHERE term_id = $1 AND state = 'PUBLISHED'`,
      [v.term_id]
    );

    // Publish this version
    const published = await client.query(
      `UPDATE schedule_versions SET state = 'PUBLISHED', published_by = $2, published_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [versionId, actorId]
    );

    // Audit log
    await auditRepo.record({
      actorAccountId: actorId,
      actorEmail: '', // Would need to fetch
      action: 'SCHEDULE_VERSION_PUBLISHED',
      entityType: 'schedule_versions',
      entityId: versionId,
      outcome: 'SUCCESS',
      details: {
        termId: v.term_id,
        versionNumber: v.version_number,
        previousPublishedArchived: true,
      },
    });

    return published.rows[0];
  });
}

module.exports = {
  validateDraft,
  getDraftForReview,
  submitForReview,
  updateDraftAllocation,
  revalidateDraft,
  publishDraft,
};