'use strict';

const { Router } = require('express');
const changeNotificationsController = require('../controllers/changeNotificationsController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, changeNotificationsController.list);
router.patch('/:id/read', authenticate, changeNotificationsController.markAsRead);
router.post('/read-all', authenticate, changeNotificationsController.markAllAsRead);

module.exports = router;