const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Exception = require('../models/Exception');
const { logAction } = require('../services/auditService');

// @route GET /api/exceptions
const listExceptions = asyncHandler(async (req, res) => {
  const { search, status, severity, category, assignedTo, page = 1, limit = 25 } = req.query;
  const query = {};

  if (search) query.title = new RegExp(search.trim(), 'i');
  if (status) query.status = status;
  if (severity) query.severity = severity;
  if (category) query.category = category;
  if (assignedTo) query.assignedTo = assignedTo;

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(100, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    Exception.find(query)
      .populate('assignedTo', 'name email')
      .populate('relatedTransactions')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    Exception.countDocuments(query),
  ]);

  res.json({ success: true, data: items, pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) } });
});

// @route GET /api/exceptions/:id
const getException = asyncHandler(async (req, res) => {
  const exception = await Exception.findById(req.params.id)
    .populate('relatedTransactions')
    .populate('assignedTo', 'name email')
    .populate('resolvedBy', 'name email')
    .populate('notes.author', 'name email')
    .populate({ path: 'reconciliation', populate: ['transactionA', 'transactionB'] });

  if (!exception) throw new ApiError(404, 'Exception not found');
  res.json({ success: true, data: exception });
});

// @route PATCH /api/exceptions/:id/assign
const assignException = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const exception = await Exception.findById(req.params.id);
  if (!exception) throw new ApiError(404, 'Exception not found');

  exception.assignedTo = userId || null;
  await exception.save();

  await logAction({
    action: 'exception_assigned',
    entityType: 'Exception',
    entityId: exception._id,
    performedBy: req.user._id,
    metadata: { assignedTo: userId || null },
  });

  res.json({ success: true, data: exception });
});

// @route PATCH /api/exceptions/:id/status
const changeStatus = asyncHandler(async (req, res) => {
  const { status, resolution } = req.body;
  const validStatuses = ['open', 'investigating', 'resolved', 'dismissed'];
  if (!validStatuses.includes(status)) throw new ApiError(400, `status must be one of: ${validStatuses.join(', ')}`);

  const exception = await Exception.findById(req.params.id);
  if (!exception) throw new ApiError(404, 'Exception not found');

  const previousStatus = exception.status;
  exception.status = status;

  if (status === 'resolved' || status === 'dismissed') {
    exception.resolution = resolution || exception.resolution;
    exception.resolvedAt = new Date();
    exception.resolvedBy = req.user._id;
  }

  await exception.save();

  await logAction({
    action: status === 'resolved' ? 'exception_resolved' : 'exception_status_changed',
    entityType: 'Exception',
    entityId: exception._id,
    performedBy: req.user._id,
    metadata: { from: previousStatus, to: status },
  });

  res.json({ success: true, data: exception });
});

// @route POST /api/exceptions/:id/notes
const addNote = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) throw new ApiError(400, 'Note text is required');

  const exception = await Exception.findById(req.params.id);
  if (!exception) throw new ApiError(404, 'Exception not found');

  exception.notes.push({ author: req.user._id, text: text.trim() });
  await exception.save();

  await logAction({
    action: 'exception_note_added',
    entityType: 'Exception',
    entityId: exception._id,
    performedBy: req.user._id,
    metadata: {},
  });

  res.status(201).json({ success: true, data: exception });
});

module.exports = { listExceptions, getException, assignException, changeStatus, addNote };
