const AuditLog = require('../models/AuditLog');

// Thin wrapper so every controller logs audit events the same way.
// Failures here are logged but never block the primary request -
// audit logging is important but must not be a single point of failure
// for core user-facing actions.
async function logAction({ action, entityType, entityId, performedBy, metadata = {} }) {
  try {
    await AuditLog.create({ action, entityType, entityId, performedBy, metadata });
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err.message);
  }
}

module.exports = { logAction };
