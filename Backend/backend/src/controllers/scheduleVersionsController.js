'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const scheduleService = require('../services/scheduleService');
const scheduleVersionsRepo = require('../repositories/scheduleVersionsRepo');
const termsRepo = require('../repositories/termsRepo');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  if (!termId) return ok(res, []);
  const versions = await scheduleService.listVersions(termId);
  return ok(res, versions);
});

const getOne = asyncHandler(async (req, res) => {
  const version = await scheduleVersionsRepo.findById(req.params.id);
  if (!version) throw ApiError.notFound('Schedule version not found.');
  return ok(res, version);
});

const getPublished = asyncHandler(async (req, res) => {
  const termId = req.query.termId ? Number(req.query.termId) : (await termsRepo.findActiveOrLatest())?.id;
  const version = await scheduleService.getPublished(termId);
  if (!version) throw ApiError.notFound('No published schedule exists for this term yet.');
  return ok(res, version);
});

const create = asyncHandler(async (req, res) => {
  const { termId, name } = req.body;
  const draft = await scheduleService.createDraft({ termId, name, actor: req.user });
  return created(res, draft);
});

const validate = asyncHandler(async (req, res) => {
  const validation = await scheduleService.validateVersion(req.params.id);
  return ok(res, validation);
});

const publish = asyncHandler(async (req, res) => {
  const published = await scheduleService.publishVersion({ versionId: req.params.id, actor: req.user });
  return ok(res, published);
});

module.exports = { list, getOne, getPublished, create, validate, publish };
