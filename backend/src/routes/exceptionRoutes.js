const express = require('express');
const { body } = require('express-validator');
const {
  listExceptions, getException, assignException, changeStatus, addNote,
} = require('../controllers/exceptionController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', listExceptions);
router.get('/:id', getException);
router.patch('/:id/assign', assignException);
router.patch(
  '/:id/status',
  [body('status').isIn(['open', 'investigating', 'resolved', 'dismissed'])],
  validate,
  changeStatus
);
router.post('/:id/notes', [body('text').trim().notEmpty()], validate, addNote);

module.exports = router;
