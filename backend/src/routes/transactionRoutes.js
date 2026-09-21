const express = require('express');
const { body } = require('express-validator');
const {
  listTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction,
} = require('../controllers/transactionController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const transactionValidators = [
  body('referenceId').trim().notEmpty().withMessage('referenceId is required'),
  body('sourceSystem')
    .isIn(['internal_ledger', 'bank_feed', 'payment_gateway', 'invoice_system', 'settlement_system'])
    .withMessage('Invalid sourceSystem'),
  body('amount').isNumeric().withMessage('amount must be a number'),
  body('transactionDate').isISO8601().withMessage('transactionDate must be a valid date'),
];

router.get('/', listTransactions);
router.get('/:id', getTransaction);
router.post('/', transactionValidators, validate, createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
