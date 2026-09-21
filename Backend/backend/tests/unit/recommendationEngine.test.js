'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { recommendAlternatives } = require('../../src/domain/recommendationEngine');
const fixture = require('../fixtures/seedFixture');

test('recommends feasible rooms only, ranked by score, with explanations', () => {
  // AI301-S2 was infeasible in LAB-01 (busy), LAB-02 (equipment shortage) and
  // LAB-10 (capacity shortage) per the constraint cases. LAB-03 is feasible.
  const roomCandidates = [fixture.rooms['LAB-01'], fixture.rooms['LAB-02'], fixture.rooms['LAB-03'], fixture.rooms['LAB-10'], fixture.rooms['ROOM-11']];

  const results = recommendAlternatives({
    roomCandidates,
    timeCandidates: [{ weekday: 7, start: '09:00', end: '11:00' }],
    requirement: fixture.requirementAI301,
    section: fixture.sections['AI301-S2'],
    instructor: fixture.instructors.instructor02,
    workingSlots: fixture.workingSlots,
    instructorAvailability: fixture.availability.instructor02,
    existingAllocations: fixture.existingAllocations,
  });

  const roomCodes = results.map((r) => r.room);
  assert.ok(roomCodes.includes('LAB-03'), `Expected LAB-03 among feasible results, got ${JSON.stringify(roomCodes)}`);
  assert.ok(!roomCodes.includes('LAB-01'), 'LAB-01 is occupied by the baseline and must not be recommended');
  assert.ok(!roomCodes.includes('LAB-02'), 'LAB-02 lacks required equipment quantity');
  assert.ok(!roomCodes.includes('LAB-10'), 'LAB-10 is below required capacity');
  assert.ok(!roomCodes.includes('ROOM-11'), 'ROOM-11 is the wrong room kind');

  for (const r of results) {
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.ok(Array.isArray(r.reasons) && r.reasons.length > 0);
  }

  // Results must be sorted descending by score.
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].score >= results[i].score);
  }
});

test('returns an empty list when nothing is feasible', () => {
  const results = recommendAlternatives({
    roomCandidates: [fixture.rooms['LAB-10']], // too small
    timeCandidates: [{ weekday: 7, start: '09:00', end: '11:00' }],
    requirement: fixture.requirementAI301,
    section: fixture.sections['AI301-S2'],
    instructor: fixture.instructors.instructor02,
    workingSlots: fixture.workingSlots,
    instructorAvailability: fixture.availability.instructor02,
    existingAllocations: fixture.existingAllocations,
  });
  assert.deepEqual(results, []);
});
