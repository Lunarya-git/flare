const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Reconciliation = require('../models/Reconciliation');
const Exception = require('../models/Exception');
const { logAction } = require('./auditService');

/**
 * FLARE Reconciliation Engine
 * ----------------------------------------------------------------------
 * Goal: compare "unmatched" Transaction records against each other and
 * decide, for each one, whether it has a genuine counterpart in a
 * DIFFERENT source system (e.g. internal_ledger vs bank_feed), and if so,
 * how well the two records agree.
 *
 * The engine deliberately avoids being a black box. Every decision is
 * expressed as a small set of boolean/numeric "signals" (reference match,
 * amount match, date match, counterparty match, status match), a weighted
 * confidence score derived from those signals, and a matchType label.
 * This keeps the logic explainable in an interview: you can point at the
 * exact signals that produced a given score.
 *
 * Weights (sum to 100):
 *   referenceMatch     -> 35  (same referenceId is the strongest signal)
 *   amountMatch        -> 30  (exact amount, or within AMOUNT_TOLERANCE_PCT)
 *   dateMatch          -> 15  (same day, or within DATE_TOLERANCE_DAYS)
 *   counterpartyMatch  -> 10  (normalized string similarity)
 *   statusMatch        -> 10  (both sides agree the txn is "completed")
 *
 * Thresholds:
 *   score >= 90                        -> exact_match
 *   score >= 40 with amount mismatch   -> amount_mismatch
 *   score >= 40 with date mismatch     -> date_mismatch
 *   score >= 40 with status mismatch   -> status_mismatch
 *   duplicate: two txns, SAME source system, same reference+amount+date
 *   no viable candidate at all         -> missing_counterpart / unmatched
 * ----------------------------------------------------------------------
 */

const WEIGHTS = {
  referenceMatch: 35,
  amountMatch: 30,
  dateMatch: 15,
  counterpartyMatch: 10,
  statusMatch: 10,
};

const AMOUNT_TOLERANCE_PCT = 0.01; // 1%
const DATE_TOLERANCE_DAYS = 1;
const EXACT_MATCH_THRESHOLD = 90;
const CANDIDATE_MIN_THRESHOLD = 40; // below this, we don't consider it a "related" record at all

function normalize(str = '') {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function daysBetween(dateA, dateB) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / msPerDay;
}

function stringSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.75;
  // crude token overlap similarity
  const setA = new Set(na.match(/.{1,3}/g) || []);
  const setB = new Set(nb.match(/.{1,3}/g) || []);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size || 1;
  return intersection / union;
}

/**
 * Compares two transactions and returns { signals, score }.
 */
function scorePair(txA, txB) {
  const signals = {
    referenceMatch: false,
    amountMatch: false,
    amountDeltaPct: null,
    dateMatch: false,
    dateDeltaDays: null,
    counterpartyMatch: false,
    statusMatch: false,
  };

  signals.referenceMatch = normalize(txA.referenceId) === normalize(txB.referenceId) && normalize(txA.referenceId) !== '';

  const amountDelta = Math.abs(txA.amount - txB.amount);
  const amountDeltaPct = txA.amount !== 0 ? amountDelta / Math.abs(txA.amount) : amountDelta > 0 ? 1 : 0;
  signals.amountDeltaPct = Number(amountDeltaPct.toFixed(4));
  signals.amountMatch = amountDeltaPct <= AMOUNT_TOLERANCE_PCT;

  const dateDeltaDays = daysBetween(txA.transactionDate, txB.transactionDate);
  signals.dateDeltaDays = Number(dateDeltaDays.toFixed(2));
  signals.dateMatch = dateDeltaDays <= DATE_TOLERANCE_DAYS;

  signals.counterpartyMatch = stringSimilarity(txA.counterparty, txB.counterparty) >= 0.6;
  signals.statusMatch = txA.status === txB.status;

  const score =
    (signals.referenceMatch ? WEIGHTS.referenceMatch : 0) +
    (signals.amountMatch ? WEIGHTS.amountMatch : 0) +
    (signals.dateMatch ? WEIGHTS.dateMatch : 0) +
    (signals.counterpartyMatch ? WEIGHTS.counterpartyMatch : 0) +
    (signals.statusMatch ? WEIGHTS.statusMatch : 0);

  return { signals, score };
}

/** Classify a scored pair into a matchType label. */
function classifyPair(signals, score) {
  if (score >= EXACT_MATCH_THRESHOLD && signals.referenceMatch && signals.amountMatch && signals.dateMatch) {
    return 'exact_match';
  }
  if (score < CANDIDATE_MIN_THRESHOLD) return null; // not related enough to call a "match" of any kind

  if (!signals.amountMatch) return 'amount_mismatch';
  if (!signals.dateMatch) return 'date_mismatch';
  if (!signals.statusMatch) return 'status_mismatch';
  // Reference matched, amount/date/status all matched, but score fell short of
  // the exact-match threshold (e.g. weak counterparty match) - still treat as exact.
  return 'exact_match';
}

function isDuplicatePair(txA, txB) {
  return (
    String(txA.sourceSystem) === String(txB.sourceSystem) &&
    normalize(txA.referenceId) === normalize(txB.referenceId) &&
    normalize(txA.referenceId) !== '' &&
    Math.abs(txA.amount - txB.amount) < 0.01 &&
    daysBetween(txA.transactionDate, txB.transactionDate) <= DATE_TOLERANCE_DAYS
  );
}

const EXCEPTION_META = {
  amount_mismatch: { title: 'Amount mismatch between source systems', severity: 'high' },
  date_mismatch: { title: 'Transaction date mismatch between source systems', severity: 'low' },
  status_mismatch: { title: 'Status mismatch between source systems', severity: 'medium' },
  duplicate: { title: 'Duplicate transaction detected', severity: 'medium' },
  missing_counterpart: { title: 'No matching record found in any other source system', severity: 'high' },
  unmatched: { title: 'Transaction could not be reconciled', severity: 'medium' },
};

async function createExceptionForReconciliation(reconciliation, txA, txB, userId) {
  const meta = EXCEPTION_META[reconciliation.matchType] || EXCEPTION_META.unmatched;
  const discrepancyAmount = txB ? Number(Math.abs(txA.amount - txB.amount).toFixed(2)) : 0;

  const exception = await Exception.create({
    title: `${meta.title} — ${txA.referenceId}`,
    category: reconciliation.matchType,
    severity: meta.severity,
    status: 'open',
    reconciliation: reconciliation._id,
    relatedTransactions: txB ? [txA._id, txB._id] : [txA._id],
    discrepancyAmount,
    createdBy: userId,
  });

  reconciliation.resultingException = exception._id;
  await reconciliation.save();

  await logAction({
    action: 'exception_created',
    entityType: 'Exception',
    entityId: exception._id,
    performedBy: userId,
    metadata: { category: exception.category, severity: exception.severity },
  });

  return exception;
}

/**
 * Runs a reconciliation pass over all transactions currently marked
 * 'unmatched'. Returns a summary of what happened.
 */
async function runReconciliation({ userId }) {
  const runId = crypto.randomUUID();
  const candidates = await Transaction.find({ reconciliationStatus: 'unmatched' }).lean(false);

  const summary = {
    runId,
    scanned: candidates.length,
    exactMatches: 0,
    exceptions: 0,
    duplicates: 0,
    unmatched: 0,
  };

  const consumed = new Set(); // transaction ids already resolved during this run

  for (const txA of candidates) {
    if (consumed.has(String(txA._id))) continue;

    // Find the best-scoring candidate from a DIFFERENT source system.
    let best = null;
    let bestScore = -1;
    let bestSignals = null;
    let duplicateOf = null;

    for (const txB of candidates) {
      if (String(txB._id) === String(txA._id)) continue;
      if (consumed.has(String(txB._id))) continue;

      if (String(txB.sourceSystem) === String(txA.sourceSystem)) {
        if (isDuplicatePair(txA, txB)) duplicateOf = txB;
        continue;
      }

      const { signals, score } = scorePair(txA, txB);
      if (score > bestScore) {
        bestScore = score;
        best = txB;
        bestSignals = signals;
      }
    }

    if (duplicateOf) {
      const reconciliation = await Reconciliation.create({
        runId,
        transactionA: txA._id,
        transactionB: duplicateOf._id,
        matchType: 'duplicate',
        confidenceScore: 100,
        signals: { referenceMatch: true, amountMatch: true, dateMatch: true, counterpartyMatch: true, statusMatch: true },
        createdBy: userId,
      });
      await Transaction.updateMany(
        { _id: { $in: [txA._id, duplicateOf._id] } },
        { reconciliationStatus: 'exception' }
      );
      await createExceptionForReconciliation(reconciliation, txA, duplicateOf, userId);
      consumed.add(String(txA._id));
      consumed.add(String(duplicateOf._id));
      summary.duplicates += 1;
      summary.exceptions += 1;
      continue;
    }

    const matchType = best ? classifyPair(bestSignals, bestScore) : null;

    if (!matchType) {
      // No viable candidate anywhere -> missing counterpart.
      const reconciliation = await Reconciliation.create({
        runId,
        transactionA: txA._id,
        transactionB: null,
        matchType: 'missing_counterpart',
        confidenceScore: 0,
        signals: {},
        createdBy: userId,
      });
      await Transaction.findByIdAndUpdate(txA._id, { reconciliationStatus: 'exception' });
      await createExceptionForReconciliation(reconciliation, txA, null, userId);
      consumed.add(String(txA._id));
      summary.unmatched += 1;
      summary.exceptions += 1;
      continue;
    }

    const reconciliation = await Reconciliation.create({
      runId,
      transactionA: txA._id,
      transactionB: best._id,
      matchType,
      confidenceScore: bestScore,
      signals: bestSignals,
      createdBy: userId,
    });

    if (matchType === 'exact_match') {
      await Transaction.updateMany(
        { _id: { $in: [txA._id, best._id] } },
        { reconciliationStatus: 'matched', matchedWith: undefined }
      );
      await Transaction.findByIdAndUpdate(txA._id, { matchedWith: best._id });
      await Transaction.findByIdAndUpdate(best._id, { matchedWith: txA._id });
      consumed.add(String(txA._id));
      consumed.add(String(best._id));
      summary.exactMatches += 1;
    } else {
      await Transaction.updateMany(
        { _id: { $in: [txA._id, best._id] } },
        { reconciliationStatus: 'exception' }
      );
      await createExceptionForReconciliation(reconciliation, txA, best, userId);
      consumed.add(String(txA._id));
      consumed.add(String(best._id));
      summary.exceptions += 1;
    }
  }

  await logAction({
    action: 'reconciliation_run',
    entityType: 'Reconciliation',
    entityId: candidates[0]?._id || userId,
    performedBy: userId,
    metadata: summary,
  });

  return summary;
}

module.exports = {
  runReconciliation,
  scorePair,
  classifyPair,
  isDuplicatePair,
  normalize,
  stringSimilarity,
  WEIGHTS,
  AMOUNT_TOLERANCE_PCT,
  DATE_TOLERANCE_DAYS,
  EXACT_MATCH_THRESHOLD,
};
