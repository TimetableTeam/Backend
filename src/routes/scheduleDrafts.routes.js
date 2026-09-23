'use strict';

const { Router } = require('express');
const scheduleDraftsController = require('../controllers/scheduleDraftsController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.get('/:draftId/allocations', authenticate, scheduleDraftsController.getAllocations);
router.get('/:draftId/workflow', authenticate, scheduleDraftsController.getWorkflow);

module.exports = router;
