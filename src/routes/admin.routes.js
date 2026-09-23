'use strict';

const { Router } = require('express');
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { authorize, ROLES } = require('../middleware/authorize');

const router = Router();

// authorize() already gives SUPER_ADMIN an automatic bypass (see
// middleware/authorize.js), so ADMIN here means "ADMIN or SUPER_ADMIN".
const adminOnly = authorize(ROLES.ADMIN);

router.get('/roles', authenticate, adminOnly, adminController.listRoles);
router.get('/accounts', authenticate, adminOnly, adminController.listAccounts);

module.exports = router;
