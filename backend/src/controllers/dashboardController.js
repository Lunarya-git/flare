const asyncHandler = require('../utils/asyncHandler');
const Transaction = require('../models/Transaction');
const Exception = require('../models/Exception');
const Reconciliation = require('../models/Reconciliation');

// @route GET /api/dashboard/summary
// Aggregates real database data for the dashboard - no mock numbers.
const getSummary = asyncHandler(async (req, res) => {
  const [
    totalTransactions,
    reconciledTransactions,
    unmatchedTransactions,
    exceptionTransactions,
    openExceptions,
    resolvedExceptions,
    dismissedExceptions,
    exceptionsBySeverity,
    exceptionsByCategory,
    discrepancySum,
    trend,
  ] = await Promise.all([
    Transaction.countDocuments({}),
    Transaction.countDocuments({ reconciliationStatus: 'matched' }),
    Transaction.countDocuments({ reconciliationStatus: 'unmatched' }),
    Transaction.countDocuments({ reconciliationStatus: 'exception' }),
    Exception.countDocuments({ status: { $in: ['open', 'investigating'] } }),
    Exception.countDocuments({ status: 'resolved' }),
    Exception.countDocuments({ status: 'dismissed' }),
    Exception.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
    Exception.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    Exception.aggregate([{ $group: { _id: null, total: { $sum: '$discrepancyAmount' } } }]),
    Reconciliation.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      totalTransactions,
      reconciledTransactions,
      unmatchedTransactions,
      exceptionTransactions,
      openExceptions,
      resolvedExceptions,
      dismissedExceptions,
      totalDiscrepancyAmount: discrepancySum[0]?.total || 0,
      exceptionsBySeverity: exceptionsBySeverity.map((e) => ({ severity: e._id, count: e.count })),
      exceptionsByCategory: exceptionsByCategory.map((e) => ({ category: e._id, count: e.count })),
      reconciliationTrend: trend.map((t) => ({ date: t._id, runs: t.count })),
    },
  });
});

module.exports = { getSummary };
