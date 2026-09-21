/**
 * Seed script - populates MongoDB with a demo user and a set of fictional
 * transactions deliberately designed to exercise every reconciliation case:
 * exact matches, amount mismatches, date mismatches, status mismatches,
 * duplicates, and unmatched/missing-counterpart records, across multiple
 * source systems.
 *
 * Usage: npm run seed  (reads MONGO_URI from .env)
 * Safe to re-run: it wipes existing demo collections first.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const Reconciliation = require('../src/models/Reconciliation');
const Exception = require('../src/models/Exception');
const AuditLog = require('../src/models/AuditLog');

async function seed() {
  await connectDB();

  console.log('[seed] Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Transaction.deleteMany({}),
    Reconciliation.deleteMany({}),
    Exception.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  console.log('[seed] Creating demo user...');
  const demoUser = await User.create({
    name: 'Demo Analyst',
    email: 'analyst@flare.demo',
    password: 'password123',
    role: 'admin',
  });

  const d = (offsetDays) => {
    const date = new Date();
    date.setDate(date.getDate() - offsetDays);
    return date;
  };

  console.log('[seed] Inserting demo transactions...');
  const txns = [
    // --- Pair 1: exact match ---
    { referenceId: 'TXN-1001', sourceSystem: 'internal_ledger', amount: 1500.0, transactionDate: d(3), description: 'Vendor payment - Acme Supplies', counterparty: 'Acme Supplies', status: 'completed' },
    { referenceId: 'TXN-1001', sourceSystem: 'bank_feed', amount: 1500.0, transactionDate: d(3), description: 'ACH debit Acme Supplies', counterparty: 'Acme Supplies', status: 'completed' },

    // --- Pair 2: amount mismatch ---
    { referenceId: 'TXN-1002', sourceSystem: 'internal_ledger', amount: 2200.0, transactionDate: d(5), description: 'Invoice payment - Beacon Corp', counterparty: 'Beacon Corp', status: 'completed' },
    { referenceId: 'TXN-1002', sourceSystem: 'payment_gateway', amount: 2185.5, transactionDate: d(5), description: 'Beacon Corp settlement', counterparty: 'Beacon Corp', status: 'completed' },

    // --- Pair 3: date mismatch ---
    { referenceId: 'TXN-1003', sourceSystem: 'internal_ledger', amount: 875.25, transactionDate: d(10), description: 'Subscription renewal - Cobalt SaaS', counterparty: 'Cobalt SaaS', status: 'completed' },
    { referenceId: 'TXN-1003', sourceSystem: 'bank_feed', amount: 875.25, transactionDate: d(7), description: 'Cobalt SaaS charge', counterparty: 'Cobalt SaaS', status: 'completed' },

    // --- Pair 4: status mismatch ---
    { referenceId: 'TXN-1004', sourceSystem: 'internal_ledger', amount: 3400.0, transactionDate: d(2), description: 'Wire transfer - Delta Logistics', counterparty: 'Delta Logistics', status: 'completed' },
    { referenceId: 'TXN-1004', sourceSystem: 'settlement_system', amount: 3400.0, transactionDate: d(2), description: 'Delta Logistics wire', counterparty: 'Delta Logistics', status: 'pending' },

    // --- Duplicates: same source, same reference/amount/date ---
    { referenceId: 'TXN-1005', sourceSystem: 'invoice_system', amount: 640.0, transactionDate: d(4), description: 'Invoice #5521 - Everline Inc', counterparty: 'Everline Inc', status: 'completed' },
    { referenceId: 'TXN-1005', sourceSystem: 'invoice_system', amount: 640.0, transactionDate: d(4), description: 'Invoice #5521 - Everline Inc (duplicate upload)', counterparty: 'Everline Inc', status: 'completed' },

    // --- Missing counterpart: only exists in one system ---
    { referenceId: 'TXN-1006', sourceSystem: 'bank_feed', amount: 199.99, transactionDate: d(1), description: 'Unrecognized bank debit', counterparty: 'Unknown Merchant', status: 'completed' },
    { referenceId: 'TXN-1007', sourceSystem: 'internal_ledger', amount: 5000.0, transactionDate: d(6), description: 'Payroll batch #44', counterparty: 'Payroll Provider', status: 'completed' },

    // --- Pair 5: another exact match, different sources ---
    { referenceId: 'TXN-1008', sourceSystem: 'payment_gateway', amount: 320.75, transactionDate: d(0), description: 'Customer refund - Falcon Retail', counterparty: 'Falcon Retail', status: 'completed' },
    { referenceId: 'TXN-1008', sourceSystem: 'internal_ledger', amount: 320.75, transactionDate: d(0), description: 'Refund Falcon Retail', counterparty: 'Falcon Retail', status: 'completed' },

    // --- Pair 6: amount + date both slightly off (multi-signal mismatch) ---
    { referenceId: 'TXN-1009', sourceSystem: 'settlement_system', amount: 9120.0, transactionDate: d(8), description: 'Settlement batch - Granite Partners', counterparty: 'Granite Partners', status: 'completed' },
    { referenceId: 'TXN-1009', sourceSystem: 'internal_ledger', amount: 8990.0, transactionDate: d(11), description: 'Granite Partners settlement', counterparty: 'Granite Partners', status: 'completed' },
  ];

  const createdTxns = await Transaction.insertMany(
    txns.map((t) => ({ ...t, createdBy: demoUser._id, currency: 'USD', reconciliationStatus: 'unmatched' }))
  );

  console.log(`[seed] Inserted ${createdTxns.length} transactions.`);

  await AuditLog.create({
    action: 'records_imported',
    entityType: 'Transaction',
    entityId: createdTxns[0]._id,
    performedBy: demoUser._id,
    metadata: { source: 'seed script', count: createdTxns.length },
  });

  console.log('[seed] Done.');
  console.log('[seed] Demo login -> email: analyst@flare.demo | password: password123');
  console.log('[seed] Run a reconciliation pass via POST /api/reconciliation/run (or the dashboard button) to generate Reconciliation + Exception records from this data.');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
