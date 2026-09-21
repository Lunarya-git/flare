const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Transaction = require('../models/Transaction');
const { logAction } = require('../services/auditService');

// @route GET /api/transactions
// Supports: search (referenceId/description/counterparty), filter (sourceSystem,
// status, reconciliationStatus, date range), sort, and pagination.
const listTransactions = asyncHandler(async (req, res) => {
  const {
    search,
    sourceSystem,
    status,
    reconciliationStatus,
    dateFrom,
    dateTo,
    sortBy = 'transactionDate',
    order = 'desc',
    page = 1,
    limit = 25,
  } = req.query;

  const query = {};

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ referenceId: regex }, { description: regex }, { counterparty: regex }];
  }
  if (sourceSystem) query.sourceSystem = sourceSystem;
  if (status) query.status = status;
  if (reconciliationStatus) query.reconciliationStatus = reconciliationStatus;
  if (dateFrom || dateTo) {
    query.transactionDate = {};
    if (dateFrom) query.transactionDate.$gte = new Date(dateFrom);
    if (dateTo) query.transactionDate.$lte = new Date(dateTo);
  }

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(100, Math.max(1, Number(limit)));
  const sortDir = order === 'asc' ? 1 : -1;

  const [items, total] = await Promise.all([
    Transaction.find(query)
      .sort({ [sortBy]: sortDir })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize),
    Transaction.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) },
  });
});

// @route GET /api/transactions/:id
const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id).populate('matchedWith');
  if (!transaction) throw new ApiError(404, 'Transaction not found');
  res.json({ success: true, data: transaction });
});

// @route POST /api/transactions
const createTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.create({ ...req.body, createdBy: req.user._id });

  await logAction({
    action: 'record_created',
    entityType: 'Transaction',
    entityId: transaction._id,
    performedBy: req.user._id,
    metadata: { referenceId: transaction.referenceId, sourceSystem: transaction.sourceSystem },
  });

  res.status(201).json({ success: true, data: transaction });
});

// @route PUT /api/transactions/:id
const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) throw new ApiError(404, 'Transaction not found');

  const editableFields = [
    'referenceId', 'sourceSystem', 'amount', 'currency', 'transactionDate',
    'description', 'counterparty', 'status',
  ];
  editableFields.forEach((field) => {
    if (req.body[field] !== undefined) transaction[field] = req.body[field];
  });

  await transaction.save();

  await logAction({
    action: 'record_updated',
    entityType: 'Transaction',
    entityId: transaction._id,
    performedBy: req.user._id,
    metadata: { updatedFields: Object.keys(req.body) },
  });

  res.json({ success: true, data: transaction });
});

// @route DELETE /api/transactions/:id
const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) throw new ApiError(404, 'Transaction not found');

  await transaction.deleteOne();

  await logAction({
    action: 'record_deleted',
    entityType: 'Transaction',
    entityId: transaction._id,
    performedBy: req.user._id,
    metadata: { referenceId: transaction.referenceId },
  });

  res.json({ success: true, message: 'Transaction deleted' });
});

module.exports = { listTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction };
