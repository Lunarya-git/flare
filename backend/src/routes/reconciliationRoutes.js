const express = require('express');
const { triggerRun, listRuns, getRun } = require('../controllers/reconciliationController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.post('/run', triggerRun);
router.get('/', listRuns);
router.get('/:id', getRun);

module.exports = router;
