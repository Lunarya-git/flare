const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Reconciliation = require('../models/Reconciliation');
const { runReconciliation } = require('../services/reconciliationEngine');

// @route POST /api/reconciliation/run
const triggerRun = asyncHandler(async (req, res) => {
  const summary = await runReconciliation({ userId: req.user._id });
  res.json({ success: true, data: summary });
});

// @route GET /api/reconciliation
const listRuns = asyncHandler(async (req, res) => {
  const { runId, matchType, page = 1, limit = 25 } = req.query;
  const query = {};
  if (runId) query.runId = runId;
  if (matchType) query.matchType = matchType;

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(100, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    Reconciliation.find(query)
      .populate('transactionA')
      .populate('transactionB')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    Reconciliation.countDocuments(query),
  ]);

  res.json({ success: true, data: items, pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) } });
});

// @route GET /api/reconciliation/:id
const getRun = asyncHandler(async (req, res) => {
  const record = await Reconciliation.findById(req.params.id).populate('transactionA').populate('transactionB').populate('resultingException');
  if (!record) throw new ApiError(404, 'Reconciliation record not found');
  res.json({ success: true, data: record });
});

module.exports = { triggerRun, listRuns, getRun };
