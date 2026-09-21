'use strict';

const { addMinutes } = require('../domain/time');
const { recommendAlternatives } = require('../domain/recommendationEngine');

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
 * Suggest feasible alternative room/time combinations for a section+requirement+instructor,
 * given that the originally requested option failed. Considers:
 *  - every active room of the requirement's required kind (falls back to all active rooms
 *    if no room kind is specified) as room candidates
 *  - the originally requested weekday/start, plus (optionally) every other working slot
 *    on the same weekday, as time candidates
 */
async function suggestAlternatives({ termId, versionId, sectionId, requirementId, instructorId, weekday, start, sameDayOnly = true, limit = 5 }) {
  const [term, requirement, instructor, section] = await Promise.all([
    termsRepo.findById(termId),
    sessionRequirementsRepo.findById(requirementId),
    accountsRepo.findById(instructorId),
    sectionsRepo.findById(sectionId),
  ]);
  if (!term) throw ApiError.notFound('Academic term not found.');
  if (!requirement) throw ApiError.notFound('Session requirement not found.');
  if (!instructor) throw ApiError.notFound('Instructor not found.');
  if (!section) throw ApiError.notFound('Section not found.');

  const [allRooms, requiredEquipment, groups, availability, existingAllocations, workingSlotRows] = await Promise.all([
    roomsRepo.listAll({ active: true, kind: requirement.required_room_kind || undefined }),
    sessionRequirementsRepo.getRequiredEquipment(requirementId),
    sectionsRepo.getGroupsForSection(sectionId),
    availabilityRepo.getAvailabilityForEngine(termId, instructorId),
    allocationsRepo.listForEngine(versionId, null),
    timeSlotsRepo.listByTerm(termId),
  ]);

  const roomIds = allRooms.map((r) => r.id);
  const equipmentByRoom = await roomsRepo.getEquipmentForRooms(roomIds);
  const roomCandidates = allRooms.map((r) => ({
    id: r.id,
    code: r.code,
    kind: r.kind,
    capacity: r.capacity,
    active: r.active,
    equipment: equipmentByRoom.get(r.id) || [],
  }));

  const workingSlots = workingSlotRows.map((r) => ({ weekday: r.weekday, start: String(r.starts_at).slice(0, 5), end: String(r.ends_at).slice(0, 5) }));

  const timeCandidates = sameDayOnly
    ? [{ weekday, start, end: addMinutes(start, requirement.duration_minutes) }]
    : workingSlots
        .filter((s) => Number(s.weekday) === Number(weekday))
        .map((s) => ({ weekday: s.weekday, start: s.start, end: addMinutes(s.start, requirement.duration_minutes) }));

  // Always include the originally requested slot even if sameDayOnly=false already implied it.
  if (!sameDayOnly && !timeCandidates.some((t) => t.start === start)) {
    timeCandidates.push({ weekday, start, end: addMinutes(start, requirement.duration_minutes) });
  }

  const closuresCache = new Map();
  const closuresForRoom = (room, wd) => {
    // Recommendation preview is best-effort and synchronous here; closures are
    // pre-warmed below to avoid async calls inside the scoring loop.
    return closuresCache.get(`${room.id}-${wd}`) || [];
  };

  // Pre-warm closures for every (room, weekday) pair actually used.
  const weekdaysUsed = [...new Set(timeCandidates.map((t) => t.weekday))];
  await Promise.all(
    roomCandidates.flatMap((room) =>
      weekdaysUsed.map(async (wd) => {
        const occurrences = await roomsRepo.getClosureOccurrencesForWeekday(room.id, wd, term.starts_on, term.ends_on);
        closuresCache.set(`${room.id}-${wd}`, occurrences);
      })
    )
  );

  const results = recommendAlternatives({
    roomCandidates,
    timeCandidates,
    requirement: {
      kind: requirement.kind,
      duration_minutes: requirement.duration_minutes,
      required_room_kind: requirement.required_room_kind,
      required_equipment: requiredEquipment.map((e) => ({ name: e.name, quantity: e.quantity })),
    },
    section: { id: section.id, code: section.code, groups: groups.map((g) => ({ id: g.id, student_count: g.student_count })) },
    instructor: { id: instructor.id, code: instructor.full_name || instructor.email },
    workingSlots,
    instructorAvailability: availability,
    existingAllocations,
    closuresForRoom,
    limit,
  });

  return results;
}

module.exports = { suggestAlternatives };
