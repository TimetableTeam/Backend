'use strict';

/**
 * Pure time helpers for the scheduling domain.
 * All functions here are side-effect free so they can be unit tested
 * without a database connection.
 */

/** Parse "HH:MM" or "HH:MM:SS" into minutes since midnight. */
function toMinutes(hhmm) {
  if (typeof hhmm !== 'string') throw new TypeError(`Expected time string, got ${typeof hhmm}`);
  const parts = hhmm.split(':').map(Number);
  const [h, m] = parts;
  if (Number.isNaN(h) || Number.isNaN(m)) throw new TypeError(`Invalid time string: ${hhmm}`);
  return h * 60 + m;
}

/** Format minutes since midnight back into "HH:MM". */
function toHHMM(mins) {
  const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Add minutes to an "HH:MM" time string, returns "HH:MM". */
function addMinutes(hhmm, minutesToAdd) {
  return toHHMM(toMinutes(hhmm) + minutesToAdd);
}

/** True if [aStart,aEnd) and [bStart,bEnd) overlap (half-open intervals). */
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  const as = toMinutes(aStart);
  const ae = toMinutes(aEnd);
  const bs = toMinutes(bStart);
  const be = toMinutes(bEnd);
  return as < be && bs < ae;
}

/** Two events overlap only if same weekday AND overlapping time ranges. */
function eventsOverlap(a, b) {
  if (Number(a.weekday) !== Number(b.weekday)) return false;
  return intervalsOverlap(a.start, a.end, b.start, b.end);
}

/**
 * Given the weekly time_slot templates for a term (each {weekday, start, end}),
 * verify that [start, requestedEnd) for the given weekday is fully covered by
 * one or more contiguous, existing slots (no gaps, no partial slot usage).
 * Returns { covered: boolean, workingDay: boolean }.
 */
function isCoveredByWorkingSlots(weekday, start, end, workingSlots) {
  const daySlots = workingSlots
    .filter((s) => Number(s.weekday) === Number(weekday))
    .slice()
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

  if (daySlots.length === 0) {
    return { covered: false, workingDay: false };
  }

  let cursor = toMinutes(start);
  const target = toMinutes(end);
  if (target <= cursor) return { covered: false, workingDay: true };

  let advanced = true;
  while (cursor < target && advanced) {
    advanced = false;
    for (const slot of daySlots) {
      const slotStart = toMinutes(slot.start);
      const slotEnd = toMinutes(slot.end);
      if (slotStart === cursor) {
        cursor = slotEnd;
        advanced = true;
        break;
      }
    }
  }

  return { covered: cursor >= target, workingDay: true };
}

/** ISO weekday (1=Mon..7=Sun) for a JS Date. */
function isoWeekday(date) {
  const day = date.getDay(); // 0=Sun..6=Sat
  return day === 0 ? 7 : day;
}

/** All calendar dates (as Date objects, UTC midnight) matching `weekday` between start/end inclusive. */
function datesForWeekday(termStartsOn, termEndsOn, weekday, holidayDates = []) {
  const holidays = new Set(holidayDates.map((d) => d.toISOString().slice(0, 10)));
  const out = [];
  const cursor = new Date(Date.UTC(termStartsOn.getUTCFullYear(), termStartsOn.getUTCMonth(), termStartsOn.getUTCDate()));
  const end = new Date(Date.UTC(termEndsOn.getUTCFullYear(), termEndsOn.getUTCMonth(), termEndsOn.getUTCDate()));
  while (cursor <= end) {
    if (isoWeekday(cursor) === Number(weekday)) {
      const iso = cursor.toISOString().slice(0, 10);
      if (!holidays.has(iso)) out.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

module.exports = {
  toMinutes,
  toHHMM,
  addMinutes,
  intervalsOverlap,
  eventsOverlap,
  isCoveredByWorkingSlots,
  isoWeekday,
  datesForWeekday,
};
