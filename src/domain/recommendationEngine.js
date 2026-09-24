'use strict';

const { evaluateCandidate } = require('./conflictEngine');

/**
 * Score a single FEASIBLE candidate. Higher is better, 0-100 scale.
 * Deterministic, explainable, no ML - matches the "reasons" style used
 * in the project brief's example response.
 */
function scoreCandidate({ room, section, requirement, existingAllocations = [], weekday, start }) {
  const reasons = [];
  let score = 100;

  const totalStudents = (section.groups || []).reduce((s, g) => s + Number(g.student_count || 0), 0);
  const capacitySlack = room.capacity - totalStudents;
  if (capacitySlack < 0) {
    // Should never happen for a feasible candidate, but guard anyway.
    return { score: 0, reasons: ['Capacity does not fit'] };
  }
  if (totalStudents > 0) {
    const utilization = totalStudents / room.capacity;
    if (utilization >= 0.6) {
      reasons.push('Capacity matches student group closely');
    } else {
      // Penalize capacity waste, proportionally, capped.
      const wastePenalty = Math.min(25, Math.round((1 - utilization) * 25));
      score -= wastePenalty;
      reasons.push(`Room is larger than needed (${Math.round(utilization * 100)}% utilized)`);
    }
  }

  if (requirement.required_room_kind && room.kind === requirement.required_room_kind) {
    reasons.push(`Room type (${room.kind}) matches requirement`);
  }

  const roomEquipmentByName = new Map((room.equipment || []).map((e) => [e.name, Number(e.quantity)]));
  const requiredEquipment = requirement.required_equipment || [];
  if (requiredEquipment.length > 0) {
    const allMatch = requiredEquipment.every((req) => (roomEquipmentByName.get(req.name) || 0) >= Number(req.quantity));
    if (allMatch) {
      reasons.push('Required equipment available');
    }
    // Extra unused equipment slightly reduces the score (mild specificity preference).
    const extraCapacityRatio = requiredEquipment.reduce((acc, req) => {
      const have = roomEquipmentByName.get(req.name) || 0;
      return acc + Math.max(0, have - Number(req.quantity));
    }, 0);
    if (extraCapacityRatio > 20) score -= 3;
  }

  reasons.push('No scheduling conflict');

  // Compactness: prefer slots that keep the room's usage adjacent to its
  // existing bookings on the same day (reduces idle gaps for facilities).
  const sameDayBookings = existingAllocations.filter((a) => a.roomId === room.id && Number(a.weekday) === Number(weekday));
  if (sameDayBookings.length > 0) {
    score += 3;
    reasons.push('Keeps room utilization compact for this day');
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

/**
 * Given a requirement/section that failed on its originally requested room,
 * evaluate a list of candidate rooms x candidate time slots and return a
 * ranked, explainable list of FEASIBLE alternatives only.
 *
 * @param {object} params
 * @param {object[]} params.roomCandidates - rooms to consider
 * @param {{weekday:number|string, start:string, end:string}[]} params.timeCandidates - time options to consider (usually just the originally requested time, plus optionally more)
 * @param {object} params.requirement
 * @param {object} params.section
 * @param {object} params.instructor
 * @param {Array} params.workingSlots
 * @param {object} params.instructorAvailability
 * @param {Array} params.existingAllocations
 * @param {(room:object, weekday:number|string)=>Array} [params.closuresForRoom] - resolver for room closure occurrences
 * @param {number} [params.limit=5]
 */
function recommendAlternatives({
  roomCandidates,
  timeCandidates,
  requirement,
  section,
  instructor,
  workingSlots,
  instructorAvailability,
  existingAllocations,
  closuresForRoom,
  limit = 5,
}) {
  const results = [];

  for (const room of roomCandidates) {
    for (const time of timeCandidates) {
      const roomClosureOccurrences = closuresForRoom ? closuresForRoom(room, time.weekday) : [];
      const evaluation = evaluateCandidate({
        weekday: time.weekday,
        start: time.start,
        end: time.end,
        requirement,
        room,
        instructor,
        section,
        workingSlots,
        instructorAvailability,
        existingAllocations,
        roomClosureOccurrences,
      });

      if (!evaluation.feasible) continue;

      const { score, reasons } = scoreCandidate({
        room,
        section,
        requirement,
        existingAllocations,
        weekday: time.weekday,
        start: time.start,
      });

      results.push({
        room: room.code,
        roomId: room.id,
        capacity: room.capacity,
        equipment: (room.equipment || []).map((item) => item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name).join(' + '),
        weekday: time.weekday,
        start: time.start,
        end: time.end,
        score,
        reasons,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

module.exports = { scoreCandidate, recommendAlternatives };
