'use strict';

const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const allocationsRepo = require('../repositories/allocationsRepo');
const termsRepo = require('../repositories/termsRepo');
const ApiError = require('../utils/ApiError');
const { isoWeekday } = require('../domain/time');

function pad(n) {
  return String(n).padStart(2, '0');
}

function icsDate(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function icsDateTime(date, hh, mm) {
  return `${icsDate(date)}T${pad(hh)}${pad(mm)}00`;
}

function escapeText(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** First calendar date on/after termStartsOn matching `weekday` (1=Mon..7=Sun). */
function firstOccurrence(termStartsOn, weekday) {
  const cursor = new Date(Date.UTC(termStartsOn.getUTCFullYear(), termStartsOn.getUTCMonth(), termStartsOn.getUTCDate()));
  while (isoWeekday(cursor) !== Number(weekday)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cursor;
}

const ICS_WEEKDAY = { 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA', 7: 'SU' };

/**
 * Build an ICS calendar for a published schedule version.
 * @param {object} opts
 * @param {number} opts.termId
 * @param {number} [opts.instructorId] filter to one instructor's sessions
 * @param {number} [opts.sectionId] filter to one section's sessions
 * @param {number} [opts.roomId] filter to one room's sessions
 */
async function buildIcsForTerm({ termId, instructorId, sectionId, roomId }) {
  const term = await termsRepo.findById(termId);
  if (!term) throw ApiError.notFound('Academic term not found.');

  const version = await scheduleVersionsRepo.findPublished(termId);
  if (!version) throw ApiError.notFound('No published schedule exists for this term yet.');

  let allocations = await allocationsRepo.listByVersion(version.id);
  if (instructorId) allocations = allocations.filter((a) => String(a.instructor_id) === String(instructorId));
  if (sectionId) allocations = allocations.filter((a) => String(a.section_id) === String(sectionId));
  if (roomId) allocations = allocations.filter((a) => String(a.room_id) === String(roomId));

  const lines = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Tanseek//Timetable Room and Lab Allocation//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push(`X-WR-CALNAME:${escapeText(term.name)} Timetable`);

  const now = new Date();
  const dtstamp = icsDateTime(now, now.getUTCHours(), now.getUTCMinutes());
  const untilDate = new Date(Date.UTC(term.ends_on.getUTCFullYear(), term.ends_on.getUTCMonth(), term.ends_on.getUTCDate(), 23, 59, 59));
  const untilStr = `${icsDate(untilDate)}T235959Z`;

  for (const a of allocations) {
    const firstDate = firstOccurrence(term.starts_on, a.weekday);
    const [sh, sm] = String(a.start).slice(0, 5).split(':').map(Number);
    const [eh, em] = String(a.end).slice(0, 5).split(':').map(Number);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:allocation-${a.id}@tanseek`);
    lines.push(`DTSTAMP:${dtstamp}Z`);
    lines.push(`DTSTART:${icsDateTime(firstDate, sh, sm)}`);
    lines.push(`DTEND:${icsDateTime(firstDate, eh, em)}`);
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${ICS_WEEKDAY[a.weekday]};UNTIL=${untilStr}`);
    lines.push(`SUMMARY:${escapeText(`${a.course_code} ${a.section_code} (${a.session_kind})`)}`);
    lines.push(`LOCATION:${escapeText(`${a.room_building ? a.room_building + ' - ' : ''}${a.room_code}`)}`);
    lines.push(`DESCRIPTION:${escapeText(`${a.course_title} \u2014 Instructor: ${a.instructor_name}`)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  // ICS requires CRLF line endings.
  return lines.join('\r\n');
}

module.exports = { buildIcsForTerm };
