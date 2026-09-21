'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const roomsRepo = require('../repositories/roomsRepo');
const auditRepo = require('../repositories/auditRepo');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const { kind, active } = req.query;
  const rooms = await roomsRepo.listAll({ kind, active: active === undefined ? undefined : active === 'true' });
  const roomIds = rooms.map((r) => r.id);
  const equipmentByRoom = await roomsRepo.getEquipmentForRooms(roomIds);
  const withEquipment = rooms.map((r) => ({ ...r, equipment: equipmentByRoom.get(r.id) || [] }));
  return ok(res, withEquipment);
});

const getOne = asyncHandler(async (req, res) => {
  const room = await roomsRepo.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found.');
  const equipment = await roomsRepo.getEquipmentForRoom(room.id);
  return ok(res, { ...room, equipment });
});

const create = asyncHandler(async (req, res) => {
  const { building, code, kind, capacity, accessible, active, managedBy } = req.body;
  const room = await roomsRepo.createRoom({ building, code, kind, capacity, accessible, active, managedBy });
  await auditRepo.record({ actorAccountId: req.user.id, actorEmail: req.user.email, action: 'ROOM_CREATED', entityType: 'rooms', entityId: room.id, outcome: 'SUCCESS' });
  return created(res, room);
});

const update = asyncHandler(async (req, res) => {
  const room = await roomsRepo.updateRoom(req.params.id, req.body);
  if (!room) throw ApiError.notFound('Room not found.');
  await auditRepo.record({ actorAccountId: req.user.id, actorEmail: req.user.email, action: 'ROOM_UPDATED', entityType: 'rooms', entityId: room.id, outcome: 'SUCCESS' });
  return ok(res, room);
});

const addClosure = asyncHandler(async (req, res) => {
  const { startsAt, endsAt, reason } = req.body;
  const closure = await roomsRepo.createClosure({ roomId: req.params.id, startsAt, endsAt, reason, createdBy: req.user.id });
  await auditRepo.record({ actorAccountId: req.user.id, actorEmail: req.user.email, action: 'ROOM_CLOSURE_CREATED', entityType: 'room_closures', entityId: closure.id, outcome: 'SUCCESS' });
  return created(res, closure);
});

module.exports = { list, getOne, create, update, addClosure };
