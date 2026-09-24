'use strict';

const { Router } = require('express');
const allocationsController = require('../controllers/allocationsController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');
const { createAllocationSchema, checkConflictsSchema } = require('../validators/allocationValidators');

const router = Router();
const manageAllocations = authorize(ROLES.ADMIN, ROLES.SCHEDULER);

router.get('/', authenticate, allocationsController.listByVersion);
router.post('/check-conflicts', authenticate, manageAllocations, checkConflictsSchema, allocationsController.checkConflicts);
router.post('/recommend', authenticate, manageAllocations, allocationsController.recommend);
router.post('/', authenticate, manageAllocations, createAllocationSchema, allocationsController.create);
router.patch('/:id', authenticate, manageAllocations, allocationsController.update);
router.delete('/:id', authenticate, manageAllocations, allocationsController.remove);

module.exports = router;
