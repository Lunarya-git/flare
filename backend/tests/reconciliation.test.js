const { scorePair, classifyPair, isDuplicatePair } = require('../src/services/reconciliationEngine');
const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

async function getToken() {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Recon Tester', email: 'recon@flare.demo', password: 'password123',
  });
  return res.body.token;
}

const baseDate = new Date('2026-01-01T00:00:00.000Z');

describe('reconciliationEngine unit logic', () => {
  it('scores an exact match at or above the exact-match threshold', () => {
    const txA = { referenceId: 'A1', amount: 100, transactionDate: baseDate, counterparty: 'Acme', status: 'completed' };
    const txB = { referenceId: 'A1', amount: 100, transactionDate: baseDate, counterparty: 'Acme', status: 'completed' };
    const { signals, score } = scorePair(txA, txB);
    expect(signals.referenceMatch).toBe(true);
    expect(signals.amountMatch).toBe(true);
    expect(signals.dateMatch).toBe(true);
    expect(score).toBeGreaterThanOrEqual(90);
    expect(classifyPair(signals, score)).toBe('exact_match');
  });

  it('classifies a large amount discrepancy as amount_mismatch', () => {
    const txA = { referenceId: 'A2', amount: 1000, transactionDate: baseDate, counterparty: 'Beacon', status: 'completed' };
    const txB = { referenceId: 'A2', amount: 850, transactionDate: baseDate, counterparty: 'Beacon', status: 'completed' };
    const { signals, score } = scorePair(txA, txB);
    expect(signals.amountMatch).toBe(false);
    expect(classifyPair(signals, score)).toBe('amount_mismatch');
  });

  it('classifies a date outside tolerance as date_mismatch when other signals align', () => {
    const later = new Date(baseDate);
    later.setDate(later.getDate() + 5);
    const txA = { referenceId: 'A3', amount: 500, transactionDate: baseDate, counterparty: 'Cobalt', status: 'completed' };
    const txB = { referenceId: 'A3', amount: 500, transactionDate: later, counterparty: 'Cobalt', status: 'completed' };
    const { signals, score } = scorePair(txA, txB);
    expect(signals.dateMatch).toBe(false);
    expect(classifyPair(signals, score)).toBe('date_mismatch');
  });

  it('classifies a status disagreement as status_mismatch when amount/date/reference align', () => {
    const txA = { referenceId: 'A4', amount: 300, transactionDate: baseDate, counterparty: 'Delta', status: 'completed' };
    const txB = { referenceId: 'A4', amount: 300, transactionDate: baseDate, counterparty: 'Delta', status: 'pending' };
    const { signals, score } = scorePair(txA, txB);
    expect(signals.statusMatch).toBe(false);
    expect(classifyPair(signals, score)).toBe('status_mismatch');
  });

  it('returns null classification for weakly related / unrelated transactions', () => {
    const txA = { referenceId: 'A5', amount: 500, transactionDate: baseDate, counterparty: 'Everline', status: 'completed' };
    const txB = { referenceId: 'Z9', amount: 50, transactionDate: new Date('2020-01-01'), counterparty: 'Unrelated Co', status: 'failed' };
    const { signals, score } = scorePair(txA, txB);
    expect(classifyPair(signals, score)).toBeNull();
  });

  it('detects duplicates within the same source system', () => {
    const txA = { referenceId: 'DUP-1', sourceSystem: 'invoice_system', amount: 640, transactionDate: baseDate };
    const txB = { referenceId: 'DUP-1', sourceSystem: 'invoice_system', amount: 640, transactionDate: baseDate };
    expect(isDuplicatePair(txA, txB)).toBe(true);
  });

  it('does not flag records from different source systems as duplicates', () => {
    const txA = { referenceId: 'DUP-2', sourceSystem: 'invoice_system', amount: 640, transactionDate: baseDate };
    const txB = { referenceId: 'DUP-2', sourceSystem: 'bank_feed', amount: 640, transactionDate: baseDate };
    expect(isDuplicatePair(txA, txB)).toBe(false);
  });
});

describe('reconciliation API - full run end to end', () => {
  it('runs reconciliation over seeded pairs and creates exceptions for mismatches', async () => {
    const token = await getToken();
    const auth = { Authorization: `Bearer ${token}` };

    const pairs = [
      // exact match
      { referenceId: 'E1', sourceSystem: 'internal_ledger', amount: 100, transactionDate: baseDate.toISOString(), counterparty: 'Acme', status: 'completed' },
      { referenceId: 'E1', sourceSystem: 'bank_feed', amount: 100, transactionDate: baseDate.toISOString(), counterparty: 'Acme', status: 'completed' },
      // amount mismatch
      { referenceId: 'E2', sourceSystem: 'internal_ledger', amount: 500, transactionDate: baseDate.toISOString(), counterparty: 'Beacon', status: 'completed' },
      { referenceId: 'E2', sourceSystem: 'payment_gateway', amount: 300, transactionDate: baseDate.toISOString(), counterparty: 'Beacon', status: 'completed' },
    ];

    for (const p of pairs) {
      await request(app).post('/api/transactions').set(auth).send(p);
    }

    const runRes = await request(app).post('/api/reconciliation/run').set(auth);
    expect(runRes.status).toBe(200);
    expect(runRes.body.data.exactMatches).toBe(1);
    expect(runRes.body.data.exceptions).toBe(1);

    const exceptionsRes = await request(app).get('/api/exceptions').set(auth);
    expect(exceptionsRes.status).toBe(200);
    expect(exceptionsRes.body.data.length).toBe(1);
    expect(exceptionsRes.body.data[0].category).toBe('amount_mismatch');
  });
});
