const mongoose = require('mongoose');

// A single financial record as it appears in ONE source system
// (internal ledger, bank feed, payment gateway, invoice system, settlement system).
// Reconciliation compares Transactions against each other across sources.
const transactionSchema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, trim: true, index: true },
    sourceSystem: {
      type: String,
      required: true,
      enum: ['internal_ledger', 'bank_feed', 'payment_gateway', 'invoice_system', 'settlement_system'],
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD', uppercase: true, trim: true },
    transactionDate: { type: Date, required: true, index: true },
    description: { type: String, trim: true, default: '' },
    counterparty: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
    },
    reconciliationStatus: {
      type: String,
      enum: ['unmatched', 'matched', 'exception'],
      default: 'unmatched',
      index: true,
    },
    matchedWith: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    importBatchId: { type: String, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

transactionSchema.index({ referenceId: 1, sourceSystem: 1 });
transactionSchema.index({ amount: 1, transactionDate: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
