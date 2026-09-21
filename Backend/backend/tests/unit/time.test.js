'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { toMinutes, addMinutes, intervalsOverlap, eventsOverlap, isCoveredByWorkingSlots } = require('../../src/domain/time');

test('toMinutes parses HH:MM', () => {
  assert.equal(toMinutes('09:00'), 540);
  assert.equal(toMinutes('00:00'), 0);
  assert.equal(toMinutes('23:59'), 1439);
});

test('addMinutes wraps within a day representation', () => {
  assert.equal(addMinutes('09:00', 120), '11:00');
  assert.equal(addMinutes('15:00', 180), '18:00');
});

test('intervalsOverlap detects half-open overlap correctly', () => {
  assert.equal(intervalsOverlap('09:00', '11:00', '10:00', '12:00'), true);
  assert.equal(intervalsOverlap('09:00', '11:00', '11:00', '13:00'), false); // touching, not overlapping
  assert.equal(intervalsOverlap('09:00', '11:00', '07:00', '09:00'), false);
});

test('eventsOverlap requires same weekday', () => {
  assert.equal(eventsOverlap({ weekday: 1, start: '09:00', end: '11:00' }, { weekday: 2, start: '09:00', end: '11:00' }), false);
  assert.equal(eventsOverlap({ weekday: 1, start: '09:00', end: '11:00' }, { weekday: 1, start: '10:00', end: '12:00' }), true);
});

test('isCoveredByWorkingSlots requires contiguous slot coverage', () => {
  const slots = [
    { weekday: 7, start: '09:00', end: '11:00' },
    { weekday: 7, start: '11:00', end: '13:00' },
  ];
  assert.equal(isCoveredByWorkingSlots(7, '09:00', '13:00', slots).covered, true);
  assert.equal(isCoveredByWorkingSlots(7, '09:00', '15:00', slots).covered, false); // 13-15 slot missing
  assert.equal(isCoveredByWorkingSlots(4, '09:00', '11:00', slots).workingDay, false); // no Thursday slots
});
