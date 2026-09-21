'use strict';

/**
 * Hand-mirrored subset of Tanseek_synthetic_seed.sql, term "Tanseek Synthetic 2027".
 * Only the rows needed to evaluate database/constraint_cases.json are included.
 * Keep in sync with backend/database/seed.sql if the seed changes.
 */

// Working slots: Sat(6), Sun(7), Mon(1), Tue(2), Wed(3) 09-11,11-13,13-15,15-17. Thu(4)/Fri(5) none.
const WEEKDAYS_WITH_SLOTS = [6, 7, 1, 2, 3];
const SLOT_STARTS = ['09:00', '11:00', '13:00', '15:00'];
const SLOT_MINUTES = 120;

function buildWorkingSlots() {
  const slots = [];
  for (const weekday of WEEKDAYS_WITH_SLOTS) {
    for (const start of SLOT_STARTS) {
      const [h, m] = start.split(':').map(Number);
      const endMinutes = h * 60 + m + SLOT_MINUTES;
      const end = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
      slots.push({ weekday, start, end });
    }
  }
  return slots;
}

const workingSlots = buildWorkingSlots();

const rooms = {
  'LAB-01': { id: 1, code: 'LAB-01', kind: 'LAB', capacity: 44, active: true, equipment: [{ name: 'COMPUTER_WITH_PYTHON', quantity: 44 }] },
  'LAB-02': { id: 2, code: 'LAB-02', kind: 'LAB', capacity: 44, active: true, equipment: [{ name: 'COMPUTER_WITH_PYTHON', quantity: 30 }] },
  'LAB-03': { id: 3, code: 'LAB-03', kind: 'LAB', capacity: 44, active: true, equipment: [{ name: 'COMPUTER_WITH_PYTHON', quantity: 44 }] },
  'LAB-10': { id: 10, code: 'LAB-10', kind: 'LAB', capacity: 30, active: true, equipment: [{ name: 'COMPUTER_WITH_PYTHON', quantity: 44 }] },
  'ROOM-11': { id: 11, code: 'ROOM-11', kind: 'CLASSROOM', capacity: 60, active: true, equipment: [{ name: 'PROJECTOR', quantity: 1 }] },
};

// AI301 requirement: PRACTICAL, 120 min, LAB, requires 40x COMPUTER_WITH_PYTHON.
const requirementAI301 = {
  kind: 'PRACTICAL',
  duration_minutes: 120,
  required_room_kind: 'LAB',
  required_equipment: [{ name: 'COMPUTER_WITH_PYTHON', quantity: 40 }],
};

const sections = {
  'AI301-S1': { id: 101, code: 'AI301-S1', groups: [{ id: 'AI301-S1-G1', student_count: 19 }, { id: 'AI301-S1-G2', student_count: 19 }] },
  // AI301-S2 groups total 40 students (20+20) - fits every lab except LAB-10 (capacity 30).
  'AI301-S2': { id: 102, code: 'AI301-S2', groups: [{ id: 'AI301-S2-G1', student_count: 20 }, { id: 'AI301-S2-G2', student_count: 20 }] },
  'AI303-S5': { id: 135, code: 'AI303-S5', groups: [{ id: 'AI303-S5-G1', student_count: 20 }] },
};

const instructors = {
  instructor01: { id: 1, code: 'instructor01' },
  instructor02: { id: 2, code: 'instructor02' },
  instructor15: { id: 15, code: 'instructor15' },
};

// Availability: instructor01 CONFIRMED, Monday 09:00 explicitly UNAVAILABLE, everything else listed AVAILABLE/PREFERRED.
const availability = {
  instructor01: {
    submissionState: 'CONFIRMED',
    slots: {
      '6-09:00': 'AVAILABLE', '6-11:00': 'AVAILABLE', '6-13:00': 'AVAILABLE', '6-15:00': 'AVAILABLE',
      '7-09:00': 'PREFERRED', '7-11:00': 'AVAILABLE', '7-13:00': 'AVAILABLE', '7-15:00': 'AVAILABLE',
      '1-09:00': 'UNAVAILABLE', '1-11:00': 'AVAILABLE', '1-13:00': 'AVAILABLE', '1-15:00': 'AVAILABLE',
      '2-09:00': 'AVAILABLE', '2-11:00': 'AVAILABLE', '2-13:00': 'AVAILABLE', '2-15:00': 'AVAILABLE',
      '3-09:00': 'AVAILABLE', '3-11:00': 'AVAILABLE', '3-13:00': 'AVAILABLE', '3-15:00': 'AVAILABLE',
    },
  },
  instructor02: {
    submissionState: 'CONFIRMED',
    slots: Object.fromEntries(
      WEEKDAYS_WITH_SLOTS.flatMap((wd) => SLOT_STARTS.map((s) => [`${wd}-${s}`, 'AVAILABLE']))
    ),
  },
  instructor15: {
    submissionState: 'DRAFT',
    slots: {},
  },
};

// Baseline allocation already on the draft version: AI301-S1, instructor01, LAB-01, Sat(7... actually Sun) 09:00-11:00.
// constraint_cases.json VALID_BASE uses weekday 7 (Sunday) start 09:00 end 11:00.
const existingAllocations = [
  {
    id: 9001,
    weekday: 7,
    start: '09:00',
    end: '11:00',
    roomId: rooms['LAB-01'].id,
    instructorId: instructors.instructor01.id,
    groupIds: ['AI301-S1-G1', 'AI301-S1-G2'],
  },
];

module.exports = {
  workingSlots,
  rooms,
  requirementAI301,
  sections,
  instructors,
  availability,
  existingAllocations,
};
