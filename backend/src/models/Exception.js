const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const exceptionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        'amount_mismatch',
        'date_mismatch',
        'status_mismatch',
        'duplicate',
        'missing_counterpart',
        'unmatched',
      ],
      required: true,
    },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    reconciliation: { type: mongoose.Schema.Types.ObjectId, ref: 'Reconciliation', required: true },
    relatedTransactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
    discrepancyAmount: { type: Number, default: 0 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: [noteSchema],
    resolution: { type: String, trim: true, default: '' },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

exceptionSchema.index({ status: 1, severity: 1 });

module.exports = mongoose.model('Exception', exceptionSchema);
