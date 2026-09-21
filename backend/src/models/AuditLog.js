const mongoose = require('mongoose');

// Append-only audit trail. Never updated or deleted after creation.
const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'user_registered',
        'user_login',
        'record_created',
        'record_updated',
        'record_deleted',
        'records_imported',
        'reconciliation_run',
        'exception_created',
        'exception_assigned',
        'exception_status_changed',
        'exception_note_added',
        'exception_resolved',
      ],
    },
    entityType: { type: String, enum: ['Transaction', 'Reconciliation', 'Exception', 'User'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
