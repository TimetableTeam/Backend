'use strict';

// Compatibility layer: the frontend still calls the legacy /master-data/:type
// paths. These routes carry no business logic of their own - they delegate
// straight to the real terms/courses/sections controllers so there is only
// ever one source of truth for that data.

const { Router } = require('express');
const { authenticate } = require('../middleware/authenticate');
const termsController = require('../controllers/termsController');
const coursesController = require('../controllers/coursesController');
const sectionsController = require('../controllers/sectionsController');

const router = Router();

router.get('/terms', authenticate, termsController.list);
router.get('/courses', authenticate, coursesController.list);
router.get('/sections', authenticate, sectionsController.list);

module.exports = router;
