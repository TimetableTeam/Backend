'use strict';

const { env } = require('../config/env');
const { withTransaction, query } = require('../db/pool');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const allocationsRepo = require('../repositories/allocationsRepo');
const auditRepo = require('../repositories/auditRepo');
const ApiError = require('../utils/ApiError');

class ModelServiceClient {
  constructor(baseUrl = env.MODEL_API_URL) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('[modelService] Failed to parse JSON:', text);
      data = {};
    }

    if (!response.ok) {
      const error = new Error(data.detail?.message || data.message || `Model API request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  // Health check
  async health() {
    return this.request('/health');
  }

  // Ready check
  async ready() {
    return this.request('/ready');
  }

  // Term readiness validation
  async checkTermReadiness(termId) {
    return this.request(`/terms/${termId}/readiness`);
  }

  // Solve timetable - returns Model result without persisting
  async solveTimetable(termId) {
    return this.request('/solve', {
      method: 'POST',
      body: JSON.stringify({ term_id: termId }),
    });
  }

  // Solve timetable AND persist results to database as a DRAFT schedule version
  async solveAndPersistTimetable(termId, actor) {
    // Call Model to solve
    const modelData = await this.request('/solve', {
      method: 'POST',
      body: JSON.stringify({ term_id: termId }),
    });

    // Model returns data directly (not wrapped in {success: true, data: ...})
    // Check for solver_status to confirm success
    if (modelData.solver_status !== 'OPTIMAL' && modelData.solver_status !== 'FEASIBLE') {
      console.error('[modelService] Model solve did not return optimal/feasible:', modelData);
      throw new Error(modelData.message || `Model solve failed with status: ${modelData.solver_status}`);
    }

    // Persist to database within a transaction
    const result = await withTransaction(async (client) => {
      // Create a new DRAFT schedule version
      const summary = modelData.summary || {};
      const draft = await scheduleVersionsRepo.createDraft(
        { termId: modelData.term_id, name: `Draft ${summary.solver_sessions || 0} sessions`, createdBy: actor.id },
        client
      );

      // Create allocations from Model's scheduled_sessions
      const scheduledSessions = modelData.scheduled_sessions || [];
      const createdAllocations = [];

      for (const session of scheduledSessions) {
        // Find the time slot ID using slot.weekday and slot.starts_at
        const slot = session.slot;
        if (!slot) {
          console.warn(`[modelService] Session ${session.session_key} missing slot info, skipping`);
          continue;
        }
        const slotRes = await client.query(
          `SELECT id FROM time_slots WHERE term_id = $1 AND weekday = $2 AND starts_at = $3`,
          [modelData.term_id, slot.weekday, slot.starts_at]
        );
        const startSlot = slotRes.rows[0];
        if (!startSlot) {
          console.warn(`[modelService] Time slot not found for weekday=${slot.weekday}, starts_at=${slot.starts_at}, term_id=${modelData.term_id}`);
          continue;
        }

        const allocation = await allocationsRepo.create(client, {
          termId: modelData.term_id,
          versionId: draft.id,
          sectionId: session.section_id,
          requirementId: session.requirement_id,
          instructorId: session.instructor?.id,
          roomId: session.room?.id,
          startSlotId: startSlot.id,
          endsAt: slot.ends_at,
          createdBy: actor.id,
        }).catch(err => {
          console.error(`[modelService] Failed to create allocation for session ${session.session_key}:`, err.message);
          throw err;
        });
        createdAllocations.push(allocation);
      }

      // Extract score data from objective_breakdown
      const obj = modelData.objective_breakdown || {};
      const candidateScore = obj.candidate_level_score ?? 0;
      const compactnessBonus = obj.compactness?.bonus ?? 0;
      const roomPenalty = obj.room_utilization?.penalty ?? 0;
      const unscheduledPenalty = obj.unscheduled?.total_penalty ?? 0;
      const finalObjective = obj.final_objective_value ?? obj.solver_objective_value ?? 0;

      // Audit log
      await auditRepo.record({
        actorAccountId: actor.id,
        actorEmail: actor.email,
        action: 'SCHEDULE_VERSION_CREATED',
        entityType: 'schedule_versions',
        entityId: draft.id,
        outcome: 'SUCCESS',
        details: {
          termId: modelData.term_id,
          scheduledCount: createdAllocations.length,
          unscheduledCount: modelData.unscheduled_sessions?.length || 0,
          score: candidateScore,
          finalObjective,
        },
      });

      return {
        draft,
        allocations: createdAllocations,
        scheduledSessions: scheduledSessions,
        unscheduledSessions: modelData.unscheduled_sessions || [],
        score: {
          candidateScore,
          compactnessBonus,
          roomPenalty,
          unscheduledPenalty,
          finalObjective,
        },
        scoreBreakdown: modelData.soft_score_definitions || {},
        alternatives: scheduledSessions.flatMap(s => s.alternatives || []),
      };
    });

    return {
      success: true,
      data: {
        ...modelData,
        persisted: true,
        draftId: result.draft.id,
        versionNumber: result.draft.version_number,
      },
    };
  }

  // Get solver summary
  async getSolverSummary() {
    return this.request('/solver/summary');
  }

  // Get scheduled sessions
  async getScheduledSessions() {
    return this.request('/solver/scheduled');
  }

  // Get unscheduled sessions
  async getUnscheduledSessions() {
    return this.request('/solver/unscheduled');
  }

  // Validate proposal
  async validateProposal(params) {
    return this.request('/validate-proposal', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Validate allocation (deprecated)
  async validateAllocation(params) {
    return this.request('/validate-allocation', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Validate change to published schedule
  async validateChange(params) {
    return this.request('/validate-change', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // --- Scheduler / Admin workflow methods ---

  // Validate a draft version
  async validateDraft(versionId, resolvedConflictIds = []) {
    return this.request(`/schedule-versions/${versionId}/validate`, {
      method: 'POST',
      body: JSON.stringify({ resolved_conflict_ids: resolvedConflictIds }),
    });
  }

  // Get draft for review
  async getDraftForReview(versionId) {
    return this.request(`/schedule-versions/${versionId}`);
  }

  // Submit draft for admin review
  async submitForReview(versionId, actorId, resolvedConflictIds = []) {
    return this.request(`/schedule-versions/${versionId}/submit-review`, {
      method: 'POST',
      body: JSON.stringify({ resolved_conflict_ids: resolvedConflictIds }),
    });
  }

  // Get draft for review
  async getDraftForReview(versionId) {
    return this.request(`/schedule-versions/${versionId}`);
  }

  // Update draft allocation
  async updateDraftAllocation(versionId, allocationId, updates, actor) {
    return this.request(`/schedule-versions/${versionId}/allocations/${allocationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...updates, actor_id: actor.id }),
    });
  }

  // Revalidate draft
  async validateDraft(versionId) {
    return this.request(`/schedule-versions/${versionId}/validate`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Publish draft
  async publishDraft(versionId, actorId) {
    return this.request(`/schedule-versions/${versionId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ actor_id: actorId }),
    });
  }

  // Update draft allocation
  async updateDraftAllocation(versionId, allocationId, updates, actor) {
    return this.request(`/schedule-versions/${versionId}/allocations/${allocationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...updates, actor_id: actor.id }),
    });
  }
}

const modelServiceClient = new ModelServiceClient();

module.exports = modelServiceClient;