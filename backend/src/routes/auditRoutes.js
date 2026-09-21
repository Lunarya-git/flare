const express = require('express');
const { listAuditLogs } = require('../controllers/auditController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);
router.get('/', listAuditLogs);

module.exports = router;
