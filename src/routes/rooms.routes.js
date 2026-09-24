'use strict';

const { Router } = require('express');
const roomsController = require('../controllers/roomsController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();
const manageRooms = authorize(ROLES.LAB_MANAGER);

router.get('/', authenticate, roomsController.list);
router.get('/:id', authenticate, roomsController.getOne);
router.post('/', authenticate, manageRooms, roomsController.create);
router.patch('/:id', authenticate, manageRooms, roomsController.update);
router.post('/:id/closures', authenticate, manageRooms, roomsController.addClosure);

module.exports = router;
