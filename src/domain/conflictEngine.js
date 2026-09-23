'use strict';

const { addMinutes, eventsOverlap, isCoveredByWorkingSlots, intervalsOverlap } = require('./time');

/**
 * CONFLICT TYPES
 * Mirrors Tanseek_constraint_cases.json vocabulary exactly, plus ROOM_CLOSED
 * which the schema's publication-gate comments require but which has no
 * dedicated case in the provided file.
 */
const CONFLICT_TYPES = Object.freeze({
  NO_WORKING_SLOT: 'NO_WORKING_SLOT',
  INVALID_DURATION: 'INVALID_DURATION',
  ROOM_TYPE_MISMATCH: 'ROOM_TYPE_MISMATCH',
  CAPACITY_SHORTAGE: 'CAPACITY_SHORTAGE',
  EQUIPMENT_SHORTAGE: 'EQUIPMENT_SHORTAGE',
  AVAILABILITY_NOT_CONFIRMED: 'AVAILABILITY_NOT_CONFIRMED',
  STAFF_UNAVAILABLE: 'STAFF_UNAVAILABLE',
  ROOM_CONFLICT: 'ROOM_CONFLICT',
  STAFF_CONFLICT: 'STAFF_CONFLICT',
  GROUP_CONFLICT: 'GROUP_CONFLICT',
  ROOM_CLOSED: 'ROOM_CLOSED',
  ROOM_INACTIVE: 'ROOM_INACTIVE',
});

/**
 * @typedef Candidate
 * @property {number|string} weekday  ISO weekday 1..7 (Mon..Sun)
 * @property {string} start  "HH:MM"
 * @property {string} end    "HH:MM"
 * @property {object} requirement { kind, duration_minutes, required_room_kind, required_equipment:[{equipment_id,name,quantity}] }
 * @property {object} room { id, code, kind, capacity, active, equipment:[{equipment_id,name,quantity}] }
 * @property {object} instructor { id, code }
 * @property {object} section { id, code, groups:[{id,code,student_count}] }
 * @property {Array}  workingSlots  [{weekday,start,end}] weekly template slots for the term
 * @property {object} instructorAvailability { submissionState: 'DRAFT'|'CONFIRMED'|null, slots: { 'weekday-HH:MM': 'AVAILABLE'|'UNAVAILABLE'|'PREFERRED' } }
 * @property {Array}  existingAllocations [{id, weekday, start, end, roomId, instructorId, groupIds:[]}] excludes the allocation being edited
 * @property {Array}  [roomClosureOccurrences] precomputed [{start:'HH:MM', end:'HH:MM', reason}] for this room on this weekday within the term (already resolved from absolute timestamps by the caller)
 */

/**
 * Evaluate one candidate allocation against every hard constraint.
 * Returns { feasible: boolean, conflicts: [{type, message}] }.
 * Never throws for ordinary infeasibility - only for malformed input.
 */
function evaluateCandidate(candidate) {
  const conflicts = [];
  const {
    weekday,
    start,
    end,
    requirement,
    room,
    instructor,
    section,
    workingSlots = [],
    instructorAvailability = { submissionState: null, slots: {} },
    existingAllocations = [],
    roomClosureOccurrences = [],
  } = candidate;

  if (!requirement) throw new TypeError('evaluateCandidate: requirement is required');
  if (!room) throw new TypeError('evaluateCandidate: room is required');

  // 1. Working day / slot existence -----------------------------------
  const coverage = isCoveredByWorkingSlots(weekday, start, end, workingSlots);
  if (!coverage.workingDay) {
    conflicts.push({
      type: CONFLICT_TYPES.NO_WORKING_SLOT,
      message: `No scheduled time slots exist on this weekday for the term.`,
    });
    // No working slots at all on this day - duration/coverage checks would be noise.
    return { feasible: false, conflicts };
  }

  // 2. Duration must match the requirement exactly ---------------------
  const expectedEnd = addMinutes(start, requirement.duration_minutes);
  if (normalizeTime(expectedEnd) !== normalizeTime(end)) {
    conflicts.push({
      type: CONFLICT_TYPES.INVALID_DURATION,
      message: `${requirement.duration_minutes}-minute session must end at ${expectedEnd}.`,
    });
  } else if (!coverage.covered) {
    conflicts.push({
      type: CONFLICT_TYPES.INVALID_DURATION,
      message: `Requested time is not fully covered by contiguous scheduled slots on this weekday.`,
    });
  }

  // 3. Room type ---------------------------------------------------------
  if (requirement.required_room_kind && room.kind !== requirement.required_room_kind) {
    conflicts.push({
      type: CONFLICT_TYPES.ROOM_TYPE_MISMATCH,
      message: `${requirement.kind} requires a ${requirement.required_room_kind} room; ${room.code} is a ${room.kind}.`,
    });
  }

  // 4. Room active -----------------------------------------------------
  if (room.active === false) {
    conflicts.push({
      type: CONFLICT_TYPES.ROOM_INACTIVE,
      message: `${room.code} is not active.`,
    });
  }

  // 5. Capacity ----------------------------------------------------------
  const groups = section?.groups || [];
  const totalStudents = groups.reduce((sum, g) => sum + Number(g.student_count || 0), 0);
  if (typeof room.capacity === 'number' && totalStudents > room.capacity) {
    conflicts.push({
      type: CONFLICT_TYPES.CAPACITY_SHORTAGE,
      message: `${room.code} capacity ${room.capacity}; section has ${totalStudents} students.`,
    });
  }

  // 6. Equipment -----------------------------------------------------------
  const requiredEquipment = requirement.required_equipment || [];
  const roomEquipmentByName = new Map((room.equipment || []).map((e) => [e.name, Number(e.quantity)]));
  for (const req of requiredEquipment) {
    const have = roomEquipmentByName.get(req.name) || 0;
    if (have < Number(req.quantity)) {
      conflicts.push({
        type: CONFLICT_TYPES.EQUIPMENT_SHORTAGE,
        message: `requires ${req.quantity} ${req.name}; ${room.code} has ${have}.`,
      });
    }
  }

  // 7. Staff availability --------------------------------------------------
  const submissionState = instructorAvailability.submissionState;
  if (submissionState !== 'CONFIRMED') {
    conflicts.push({
      type: CONFLICT_TYPES.AVAILABILITY_NOT_CONFIRMED,
      message: `${instructor?.code || 'Instructor'} availability submission is ${submissionState || 'missing'}, not CONFIRMED.`,
    });
  } else {
    const key = `${weekday}-${normalizeTime(start)}`;
    const kind = instructorAvailability.slots ? instructorAvailability.slots[key] : undefined;
    // Missing row after confirmation is treated as unavailable per schema
    // publication-gate rule #1: "selected time must be AVAILABLE or PREFERRED.
    // Missing row is unavailable."
    if (kind === 'UNAVAILABLE' || kind === undefined) {
      conflicts.push({
        type: CONFLICT_TYPES.STAFF_UNAVAILABLE,
        message: `${instructor?.code || 'Instructor'} is unavailable at this time.`,
      });
    }
  }

  // 8. Room closures --------------------------------------------------------
  for (const closure of roomClosureOccurrences) {
    if (intervalsOverlap(start, end, closure.start, closure.end)) {
      conflicts.push({
        type: CONFLICT_TYPES.ROOM_CLOSED,
        message: `${room.code} is closed during this time (${closure.reason || 'closure'}).`,
      });
    }
  }

  // 9-11. Overlap against existing allocations in the same schedule version --
  const candidateEvent = { weekday, start, end };
  const candidateGroupIds = new Set(groups.map((g) => g.id));
  for (const existing of existingAllocations) {
    if (!eventsOverlap(candidateEvent, existing)) continue;

    if (room?.id != null && existing.roomId === room.id) {
      conflicts.push({
        type: CONFLICT_TYPES.ROOM_CONFLICT,
        message: `${room.code} is already occupied during this time slot.`,
      });
    }
    if (instructor?.id != null && existing.instructorId === instructor.id) {
      conflicts.push({
        type: CONFLICT_TYPES.STAFF_CONFLICT,
        message: `${instructor.code || 'Instructor'} already has another session at this time.`,
      });
    }
    const sharedGroup = (existing.groupIds || []).some((gid) => candidateGroupIds.has(gid));
    if (sharedGroup) {
      conflicts.push({
        type: CONFLICT_TYPES.GROUP_CONFLICT,
        message: `A student group in this section already has a session at this time.`,
      });
    }
  }

  return { feasible: conflicts.length === 0, conflicts };
}

function normalizeTime(hhmmss) {
  // Accept "HH:MM" or "HH:MM:SS", compare on "HH:MM"
  return hhmmss.length > 5 ? hhmmss.slice(0, 5) : hhmmss;
}

module.exports = { evaluateCandidate, CONFLICT_TYPES };
