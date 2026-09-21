'use strict';

const { validateBody, required, isPositiveInt, isTime, isWeekday, all } = require('./validate');

const createAllocationSchema = validateBody({
  versionId: all(required('versionId'), isPositiveInt('versionId')),
  sectionId: all(required('sectionId'), isPositiveInt('sectionId')),
  requirementId: all(required('requirementId'), isPositiveInt('requirementId')),
  instructorId: all(required('instructorId'), isPositiveInt('instructorId')),
  roomId: all(required('roomId'), isPositiveInt('roomId')),
  weekday: all(required('weekday'), isWeekday('weekday')),
  start: all(required('start'), isTime('start')),
});

const checkConflictsSchema = validateBody({
  sectionId: all(required('sectionId'), isPositiveInt('sectionId')),
  requirementId: all(required('requirementId'), isPositiveInt('requirementId')),
  instructorId: all(required('instructorId'), isPositiveInt('instructorId')),
  roomId: all(required('roomId'), isPositiveInt('roomId')),
  weekday: all(required('weekday'), isWeekday('weekday')),
  start: all(required('start'), isTime('start')),
  versionId: all(required('versionId'), isPositiveInt('versionId')),
});

module.exports = { createAllocationSchema, checkConflictsSchema };
