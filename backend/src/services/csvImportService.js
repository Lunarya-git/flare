const { parse } = require('csv-parse/sync');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const { logAction } = require('./auditService');

const REQUIRED_COLUMNS = ['referenceId', 'sourceSystem', 'amount', 'transactionDate'];
const VALID_SOURCES = ['internal_ledger', 'bank_feed', 'payment_gateway', 'invoice_system', 'settlement_system'];
const VALID_STATUSES = ['pending', 'completed', 'failed', 'reversed'];

function validateRow(row, index) {
  const errors = [];

  for (const col of REQUIRED_COLUMNS) {
    if (!row[col] || String(row[col]).trim() === '') {
      errors.push(`Row ${index}: missing required column "${col}"`);
    }
  }

  if (row.sourceSystem && !VALID_SOURCES.includes(row.sourceSystem)) {
    errors.push(`Row ${index}: invalid sourceSystem "${row.sourceSystem}"`);
  }

  if (row.amount && Number.isNaN(Number(row.amount))) {
    errors.push(`Row ${index}: amount "${row.amount}" is not a number`);
  }

  if (row.transactionDate && Number.isNaN(Date.parse(row.transactionDate))) {
    errors.push(`Row ${index}: transactionDate "${row.transactionDate}" is not a valid date`);
  }

  if (row.status && !VALID_STATUSES.includes(row.status)) {
    errors.push(`Row ${index}: invalid status "${row.status}"`);
  }

  return errors;
}

function normalizeRow(row, userId, importBatchId) {
  return {
    referenceId: String(row.referenceId).trim(),
    sourceSystem: row.sourceSystem.trim(),
    amount: Number(row.amount),
    currency: (row.currency || 'USD').trim().toUpperCase(),
    transactionDate: new Date(row.transactionDate),
    description: (row.description || '').trim(),
    counterparty: (row.counterparty || '').trim(),
    status: (row.status || 'completed').trim(),
    reconciliationStatus: 'unmatched',
    importBatchId,
    createdBy: userId,
  };
}

/**
 * Full pipeline: raw CSV text -> parsed rows -> validated -> normalized ->
 * duplicate-checked against existing DB records -> inserted.
 * Returns a summary object describing what happened to each row.
 */
async function importCsv({ csvText, userId }) {
  const importBatchId = crypto.randomUUID();

  let records;
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    throw new Error(`Failed to parse CSV: ${err.message}`);
  }

  const summary = {
    importBatchId,
    totalRows: records.length,
    inserted: 0,
    invalid: 0,
    duplicates: 0,
    invalidRows: [],
    duplicateRows: [],
  };

  const toInsert = [];
  const seenInBatch = new Set();

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    const rowNum = i + 2; // account for header row, 1-indexed
    const errors = validateRow(row, rowNum);

    if (errors.length > 0) {
      summary.invalid += 1;
      summary.invalidRows.push({ row: rowNum, errors });
      continue;
    }

    const normalized = normalizeRow(row, userId, importBatchId);
    const dedupeKey = `${normalized.referenceId}|${normalized.sourceSystem}|${normalized.amount}|${normalized.transactionDate.toISOString().slice(0, 10)}`;

    if (seenInBatch.has(dedupeKey)) {
      summary.duplicates += 1;
      summary.duplicateRows.push({ row: rowNum, referenceId: normalized.referenceId, reason: 'duplicate_within_file' });
      continue;
    }

    // Check against existing DB records for the same source+reference+date window.
    const existing = await Transaction.findOne({
      referenceId: normalized.referenceId,
      sourceSystem: normalized.sourceSystem,
      amount: normalized.amount,
    });

    if (existing) {
      summary.duplicates += 1;
      summary.duplicateRows.push({ row: rowNum, referenceId: normalized.referenceId, reason: 'already_in_database' });
      continue;
    }

    seenInBatch.add(dedupeKey);
    toInsert.push(normalized);
  }

  let inserted = [];
  if (toInsert.length > 0) {
    inserted = await Transaction.insertMany(toInsert, { ordered: false });
    summary.inserted = inserted.length;
  }

  await logAction({
    action: 'records_imported',
    entityType: 'Transaction',
    entityId: inserted[0]?._id || userId,
    performedBy: userId,
    metadata: {
      importBatchId,
      totalRows: summary.totalRows,
      inserted: summary.inserted,
      invalid: summary.invalid,
      duplicates: summary.duplicates,
    },
  });

  return summary;
}

module.exports = { importCsv, validateRow, normalizeRow, REQUIRED_COLUMNS, VALID_SOURCES, VALID_STATUSES };
