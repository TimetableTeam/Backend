'use strict';

const { query } = require('../db/pool');
const roomsRepo = require('../repositories/roomsRepo');
const timeSlotsRepo = require('../repositories/timeSlotsRepo');
const allocationsRepo = require('../repositories/allocationsRepo');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const scheduleService = require('./scheduleService');
const ApiError = require('../utils/ApiError');

async function getSummary({ termId, versionId }) {
  const version = await scheduleVersionsRepo.findById(versionId);
  if (!version || version.term_id !== termId) throw ApiError.notFound('Schedule version not found for this term.');

  const [rooms, workingSlots, allocations, sectionsTotalRes, groupsTotalRes] = await Promise.all([
    roomsRepo.listAll({}),
    timeSlotsRepo.listByTerm(termId),
    allocationsRepo.listByVersion(versionId),
    query(`SELECT count(*)::int AS n FROM sections WHERE term_id = $1`, [termId]),
    query(`SELECT count(*)::int AS n FROM student_groups WHERE term_id = $1`, [termId]),
  ]);

  const totalWeeklySlots = workingSlots.length;
  const roomBookingCounts = new Map();
  for (const a of allocations) {
    roomBookingCounts.set(a.room_id, (roomBookingCounts.get(a.room_id) || 0) + 1);
  }

  const roomUtilization = rooms
    .filter((r) => r.active)
    .map((r) => {
      const booked = roomBookingCounts.get(r.id) || 0;
      const utilizationPct = totalWeeklySlots > 0 ? Math.round((booked / totalWeeklySlots) * 1000) / 10 : 0;
      return { roomId: r.id, roomCode: r.code, kind: r.kind, capacity: r.capacity, bookedSlots: booked, totalWeeklySlots, utilizationPct };
    })
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  const avgUtilization =
    roomUtilization.length > 0 ? Math.round((roomUtilization.reduce((s, r) => s + r.utilizationPct, 0) / roomUtilization.length) * 10) / 10 : 0;

  const sectionsWithAllocations = new Set(allocations.map((a) => a.section_id ?? a.id)).size; // section_id present in listByVersion? see note below
  const totalSections = sectionsTotalRes.rows[0].n;

  const validation = await scheduleService.validateVersion(versionId);

  return {
    term: { id: termId },
    version: { id: versionId, name: version.name, state: version.state, versionNumber: version.version_number },
    counts: {
      totalRooms: rooms.length,
      activeRooms: rooms.filter((r) => r.active).length,
      totalAllocations: allocations.length,
      totalSections,
      totalStudentGroups: groupsTotalRes.rows[0].n,
    },
    utilization: {
      averagePct: avgUtilization,
      byRoom: roomUtilization,
    },
    conflicts: {
      violatingAllocations: validation.violations.length,
      isPublishable: validation.valid,
    },
  };
}

module.exports = { getSummary };
