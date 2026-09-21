const asyncHandler = require('../utils/asyncHandler');
const AuditLog = require('../models/AuditLog');

// @route GET /api/audit
const listAuditLogs = asyncHandler(async (req, res) => {
  const { entityType, entityId, action, page = 1, limit = 50 } = req.query;
  const query = {};
  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = entityId;
  if (action) query.action = action;

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(200, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .populate('performedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    AuditLog.countDocuments(query),
  ]);

  res.json({ success: true, data: items, pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) } });
});

module.exports = { listAuditLogs };
