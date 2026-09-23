'use strict';

const { addMinutes } = require('../domain/time');
const { evaluateCandidate } = require('../domain/conflictEngine');

const roomsRepo = require('../repositories/roomsRepo');
const sectionsRepo = require('../repositories/sectionsRepo');
const sessionRequirementsRepo = require('../repositories/sessionRequirementsRepo');
const timeSlotsRepo = require('../repositories/timeSlotsRepo');
const termsRepo = require('../repositories/termsRepo');
const availabilityRepo = require('../repositories/availabilityRepo');
const allocationsRepo = require('../repositories/allocationsRepo');
const accountsRepo = require('../repositories/accountsRepo');
const ApiError = require('../utils/ApiError');

/**
 * Load every piece of context needed to evaluate one candidate allocation,
 * run it through the pure conflict engine, and return everything the caller
 * needs both to report the result and (if feasible) to persist the write.
 *
 * @param {object} params
 * @param {number} params.termId
 * @param {number} params.versionId
 * @param {number} params.sectionId
 * @param {number} params.requirementId
 * @param {number} params.instructorId
 * @param {number} params.roomId
 * @param {number|string} params.weekday
 * @param {string} params.start  "HH:MM"
 * @param {number|null} [params.excludeAllocationId] - omit this allocation from overlap checks (editing)
 */
async function buildAndEvaluateCandidate({ termId, versionId, sectionId, requirementId, instructorId, roomId, weekday, start, excludeAllocationId = null }) {
  const [term, requirement, room, instructor, section] = await Promise.all([
    termsRepo.findById(termId),
    sessionRequirementsRepo.findById(requirementId),
    roomsRepo.findById(roomId),
    accountsRepo.findById(instructorId),
    sectionsRepo.findById(sectionId),
  ]);

  if (!term) throw ApiError.notFound('Academic term not found.');
  if (!requirement) throw ApiError.notFound('Session requirement not found.');
  if (!room) throw ApiError.notFound('Room not found.');
  if (!instructor) throw ApiError.notFound('Instructor not found.');
  if (!section) throw ApiError.notFound('Section not found.');

  const qualified = await sectionsRepo.isInstructorQualified(sectionId, instructorId, requirementId);
  if (!qualified) {
    throw ApiError.badRequest('This instructor is not assigned/qualified to teach this section for this requirement.');
  }

  const end = addMinutes(start, requirement.duration_minutes);

  const [workingSlotRows, roomEquipment, requiredEquipment, groups, availability, existingAllocations, closures, startTimeSlot] = await Promise.all([
    timeSlotsRepo.listByTerm(termId),
    roomsRepo.getEquipmentForRoom(roomId),
    sessionRequirementsRepo.getRequiredEquipment(requirementId),
    sectionsRepo.getGroupsForSection(sectionId),
    availabilityRepo.getAvailabilityForEngine(termId, instructorId),
    allocationsRepo.listForEngine(versionId, excludeAllocationId),
    roomsRepo.getClosureOccurrencesForWeekday(roomId, weekday, term.starts_on, term.ends_on),
    timeSlotsRepo.findByTermWeekdayStart(termId, weekday, start),
  ]);

  const workingSlots = workingSlotRows.map((r) => ({
    weekday: r.weekday,
    start: String(r.starts_at).slice(0, 5),
    end: String(r.ends_at).slice(0, 5),
  }));

  const candidate = {
    weekday,
    start,
    end,
    requirement: {
      kind: requirement.kind,
      duration_minutes: requirement.duration_minutes,
      required_room_kind: requirement.required_room_kind,
      required_equipment: requiredEquipment.map((e) => ({ name: e.name, quantity: e.quantity })),
    },
    room: {
      id: room.id,
      code: room.code,
      kind: room.kind,
      capacity: room.capacity,
      active: room.active,
      equipment: roomEquipment.map((e) => ({ name: e.name, quantity: e.quantity })),
    },
    instructor: { id: instructor.id, code: instructor.full_name || instructor.email },
    section: {
      id: section.id,
      code: section.code,
      groups: groups.map((g) => ({ id: g.id, student_count: g.student_count })),
    },
    workingSlots,
    instructorAvailability: availability,
    existingAllocations,
    roomClosureOccurrences: closures,
  };

  const result = evaluateCandidate(candidate);

  return {
    result,
    resolved: { term, requirement, room, instructor, section, startTimeSlot, end },
  };
}

module.exports = { buildAndEvaluateCandidate };
