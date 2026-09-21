import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import TransactionItem from './TransactionItem';
import TransactionForm from './TransactionForm';

const SOURCE_SYSTEMS = ['', 'internal_ledger', 'bank_feed', 'payment_gateway', 'invoice_system', 'settlement_system'];
const RECON_STATUSES = ['', 'unmatched', 'matched', 'exception'];

// This is the "TaskList" of the assignment, mapped to FLARE's domain:
// fetches transactions from the backend and renders each via TransactionItem.
export default function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [sourceSystem, setSourceSystem] = useState('');
  const [reconciliationStatus, setReconciliationStatus] = useState('');
  const [sortBy, setSortBy] = useState('transactionDate');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  // Equivalent to the assignment's componentDidMount GET-on-load, implemented with useEffect.
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions', {
        params: { search, sourceSystem, reconciliationStatus, sortBy, order, page, limit: 10 },
      });
      setTransactions(res.data.data);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, sourceSystem, reconciliationStatus, sortBy, order, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleCreate = async (payload) => {
    await api.post('/transactions', payload);
    setShowForm(false);
    fetchTransactions();
  };

  const handleUpdate = async (payload) => {
    await api.put(`/transactions/${editing._id}`, payload);
    setEditing(null);
    fetchTransactions();
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete transaction ${t.referenceId}?`)) return;
    await api.delete(`/transactions/${t._id}`);
    fetchTransactions();
  };

  return (
    <div>
      <div className="toolbar">
        <input placeholder="Search reference, description, counterparty..." value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} style={{ minWidth: 260 }} />
        <select value={sourceSystem} onChange={(e) => { setPage(1); setSourceSystem(e.target.value); }}>
          {SOURCE_SYSTEMS.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All sources'}</option>)}
        </select>
        <select value={reconciliationStatus} onChange={(e) => { setPage(1); setReconciliationStatus(e.target.value); }}>
          {RECON_STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select value={`${sortBy}:${order}`} onChange={(e) => { const [sb, o] = e.target.value.split(':'); setSortBy(sb); setOrder(o); }}>
          <option value="transactionDate:desc">Date (newest)</option>
          <option value="transactionDate:asc">Date (oldest)</option>
          <option value="amount:desc">Amount (high-low)</option>
          <option value="amount:asc">Amount (low-high)</option>
        </select>
        <button className="primary" style={{ marginLeft: 'auto' }} onClick={() => { setShowForm((s) => !s); setEditing(null); }}>
          {showForm ? 'Close form' : '+ New record'}
        </button>
      </div>

      {(showForm || editing) && (
        <div style={{ marginBottom: 16 }}>
          <TransactionForm
            initialValue={editing}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="muted">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="muted">No transactions match these filters.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference</th><th>Source</th><th>Amount</th><th>Date</th><th>Counterparty</th><th>Status</th><th>Reconciliation</th><th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <TransactionItem key={t._id} transaction={t} onEdit={(tx) => { setEditing(tx); setShowForm(false); }} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        )}
        <div className="pagination">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {pagination.page} of {pagination.pages || 1} · {pagination.total} records</span>
          <button className="secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
