'use strict';

const { Router } = require('express');
const calendarController = require('../controllers/calendarController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

// Only ever serves the PUBLISHED schedule, so any authenticated role
// (including STUDENT) may export it.
router.get('/export.ics', authenticate, calendarController.exportIcs);

module.exports = router;
