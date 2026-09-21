const mongoose = require('mongoose');

// One Reconciliation document represents the OUTCOME of comparing two
// transaction records (or one record with no counterpart) during a run.
const reconciliationSchema = new mongoose.Schema(
  {
    runId: { type: String, required: true, index: true },
    transactionA: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
    transactionB: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    matchType: {
      type: String,
      enum: [
        'exact_match',
        'amount_mismatch',
        'date_mismatch',
        'status_mismatch',
        'duplicate',
        'missing_counterpart',
        'unmatched',
      ],
      required: true,
    },
    confidenceScore: { type: Number, min: 0, max: 100, required: true },
    signals: {
      referenceMatch: { type: Boolean, default: false },
      amountMatch: { type: Boolean, default: false },
      amountDeltaPct: { type: Number, default: null },
      dateMatch: { type: Boolean, default: false },
      dateDeltaDays: { type: Number, default: null },
      counterpartyMatch: { type: Boolean, default: false },
      statusMatch: { type: Boolean, default: false },
    },
    resultingException: { type: mongoose.Schema.Types.ObjectId, ref: 'Exception', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reconciliation', reconciliationSchema);
