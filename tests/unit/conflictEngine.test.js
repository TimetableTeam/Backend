'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const { evaluateCandidate, CONFLICT_TYPES } = require('../../src/domain/conflictEngine');
const fixture = require('../fixtures/seedFixture');

const casesPath = path.join(__dirname, '..', '..', 'database', 'constraint_cases.json');
const { cases } = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

function buildCandidate(testCase) {
  const section = fixture.sections[testCase.section];
  const instructor = fixture.instructors[testCase.instructor];
  const room = fixture.rooms[testCase.room];
  if (!section) throw new Error(`Fixture missing section ${testCase.section}`);
  if (!instructor) throw new Error(`Fixture missing instructor ${testCase.instructor}`);
  if (!room) throw new Error(`Fixture missing room ${testCase.room}`);

  // Special fixture for GROUP_COLLISION: replace one S2 group link with AI301-S1-G1,
  // as instructed in the case's own "fixture" note, without mutating shared baseline data.
  let effectiveSection = section;
  if (testCase.id === 'GROUP_COLLISION') {
    effectiveSection = {
      ...section,
      groups: [{ id: 'AI301-S1-G1', student_count: 19 }, section.groups[1]],
    };
  }

  // VALID_BASE *is* the one existing baseline allocation - evaluating it
  // against itself would spuriously conflict, so exclude self (mirrors how
  // the service layer excludes the allocation being edited from the overlap set).
  const existingAllocations = testCase.id === 'VALID_BASE' ? [] : fixture.existingAllocations;

  return {
    weekday: testCase.weekday,
    start: testCase.start,
    end: testCase.end,
    requirement: fixture.requirementAI301,
    room,
    instructor,
    section: effectiveSection,
    workingSlots: fixture.workingSlots,
    instructorAvailability: fixture.availability[testCase.instructor],
    existingAllocations,
    roomClosureOccurrences: [],
  };
}

test('conflict engine matches every Tanseek_constraint_cases.json scenario', async (t) => {
  for (const testCase of cases) {
    await t.test(`${testCase.id}: expects ${testCase.expected}`, () => {
      const candidate = buildCandidate(testCase);
      const result = evaluateCandidate(candidate);
      const types = result.conflicts.map((c) => c.type);

      if (testCase.expected === 'FEASIBLE') {
        assert.equal(result.feasible, true, `Expected FEASIBLE but got conflicts: ${JSON.stringify(types)}`);
      } else {
        assert.ok(
          types.includes(testCase.expected),
          `Expected conflict type ${testCase.expected} to be present. Got: ${JSON.stringify(types)}`
        );
        assert.equal(result.feasible, false);
      }
    });
  }
});

test('conflict engine: all CONFLICT_TYPES values are unique strings', () => {
  const values = Object.values(CONFLICT_TYPES);
  assert.equal(new Set(values).size, values.length);
});

test('conflict engine: a fully clear candidate different from baseline is feasible', () => {
  const candidate = {
    weekday: 6,
    start: '09:00',
    end: '11:00',
    requirement: fixture.requirementAI301,
    room: fixture.rooms['LAB-03'],
    instructor: fixture.instructors.instructor02,
    section: fixture.sections['AI301-S2'],
    workingSlots: fixture.workingSlots,
    instructorAvailability: fixture.availability.instructor02,
    existingAllocations: fixture.existingAllocations,
    roomClosureOccurrences: [],
  };
  const result = evaluateCandidate(candidate);
  assert.equal(result.feasible, true, JSON.stringify(result.conflicts));
});
