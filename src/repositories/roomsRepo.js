'use strict';

const { query } = require('../db/pool');

async function listAll({ kind, active } = {}) {
  const clauses = [];
  const params = [];
  if (kind) {
    params.push(kind);
    clauses.push(`r.kind = $${params.length}`);
  }
  if (active !== undefined) {
    params.push(active);
    clauses.push(`r.active = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await query(
    `SELECT r.id, r.building, r.code, r.kind, r.capacity, r.accessible, r.active, r.managed_by, r.updated_at, r.frontend_type, r.frontend_status, r.closure_note
     FROM rooms r ${where} ORDER BY r.building, r.code`,
    params
  );
  return res.rows;
}

async function findById(id) {
  const res = await query(`SELECT * FROM rooms WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function getEquipmentForRoom(roomId) {
  const res = await query(
    `SELECT e.id AS equipment_id, e.name, re.quantity
     FROM room_equipment re JOIN equipment e ON e.id = re.equipment_id
     WHERE re.room_id = $1`,
    [roomId]
  );
  return res.rows;
}

/** Batch-load equipment for many rooms at once (avoids N+1 queries). */
async function getEquipmentForRooms(roomIds) {
  if (roomIds.length === 0) return new Map();
  const res = await query(
    `SELECT re.room_id, e.name, re.quantity
     FROM room_equipment re JOIN equipment e ON e.id = re.equipment_id
     WHERE re.room_id = ANY($1::bigint[])`,
    [roomIds]
  );
  const map = new Map();
  for (const row of res.rows) {
    if (!map.has(row.room_id)) map.set(row.room_id, []);
    map.get(row.room_id).push({ name: row.name, quantity: row.quantity });
  }
  return map;
}

async function createRoom({ building, code, kind, capacity, accessible = false, active = true, managedBy = null }) {
  const res = await query(
    `INSERT INTO rooms (building, code, kind, capacity, accessible, active, managed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [building, code, kind, capacity, accessible, active, managedBy]
  );
  return res.rows[0];
}

async function updateRoom(id, fields) {
  const allowed = ['building', 'code', 'kind', 'capacity', 'accessible', 'active', 'managed_by', 'frontend_type', 'frontend_status', 'closure_note'];
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.includes(key)) continue;
    params.push(value);
    sets.push(`${key} = $${params.length}`);
  }
  if (sets.length === 0) return findById(id);
  params.push(id);
  const res = await query(`UPDATE rooms SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
  return res.rows[0];
}

/** Closures overlapping an absolute [startsAt, endsAt) UTC window for a room. */
async function getClosuresForRoomInRange(roomId, startsAt, endsAt) {
  const res = await query(
    `SELECT id, starts_at, ends_at, reason FROM room_closures
     WHERE room_id = $1 AND starts_at < $3 AND ends_at > $2
     ORDER BY starts_at`,
    [roomId, startsAt, endsAt]
  );
  return res.rows;
}

async function createClosure({ roomId, startsAt, endsAt, reason, createdBy }) {
  const res = await query(
    `INSERT INTO room_closures (room_id, starts_at, ends_at, reason, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [roomId, startsAt, endsAt, reason, createdBy]
  );
  return res.rows[0];
}

/**
 * Resolve room closures onto a weekly-template weekday, in local wall-clock
 * time, for the purpose of the conflict engine. Simplification for this
 * project's timeline: a closure is matched to `weekday` if its local start
 * date falls on that ISO weekday and within the term's date range. Closures
 * spanning multiple calendar days are matched by their start date only.
 */
async function getClosureOccurrencesForWeekday(roomId, weekday, termStartsOn, termEndsOn) {
  const res = await query(
    `SELECT
        (starts_at AT TIME ZONE 'Africa/Cairo')::time AS local_start,
        (ends_at AT TIME ZONE 'Africa/Cairo')::time AS local_end,
        reason
     FROM room_closures
     WHERE room_id = $1
       AND EXTRACT(ISODOW FROM (starts_at AT TIME ZONE 'Africa/Cairo')) = $2
       AND (starts_at AT TIME ZONE 'Africa/Cairo')::date >= $3::date
       AND ($4::date IS NULL OR (starts_at AT TIME ZONE 'Africa/Cairo')::date <= $4::date)`,
    [roomId, weekday, termStartsOn, termEndsOn]
  );
  return res.rows.map((r) => ({ start: String(r.local_start).slice(0, 5), end: String(r.local_end).slice(0, 5), reason: r.reason }));
}

module.exports = {
  listAll,
  findById,
  getEquipmentForRoom,
  getEquipmentForRooms,
  createRoom,
  updateRoom,
  getClosuresForRoomInRange,
  createClosure,
  getClosureOccurrencesForWeekday,
};
