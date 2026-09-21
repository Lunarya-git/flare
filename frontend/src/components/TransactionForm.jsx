import { useState } from 'react';

const SOURCE_SYSTEMS = ['internal_ledger', 'bank_feed', 'payment_gateway', 'invoice_system', 'settlement_system'];
const STATUSES = ['pending', 'completed', 'failed', 'reversed'];

const emptyForm = {
  referenceId: '',
  sourceSystem: 'internal_ledger',
  amount: '',
  currency: 'USD',
  transactionDate: new Date().toISOString().slice(0, 10),
  description: '',
  counterparty: '',
  status: 'completed',
};

// Handles both "create new transaction" and "edit existing transaction",
// following the assignment's handleInputChange / handleSubmit pattern via hooks.
export default function TransactionForm({ initialValue, onSubmit, onCancel }) {
  const [form, setForm] = useState(initialValue ? { ...emptyForm, ...initialValue, transactionDate: initialValue.transactionDate?.slice(0, 10) } : emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.referenceId.trim() || !form.amount || !form.transactionDate) {
      setError('Reference ID, amount, and transaction date are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ ...form, amount: Number(form.amount) });
      if (!initialValue) setForm(emptyForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3 style={{ marginTop: 0 }}>{initialValue ? 'Edit transaction' : 'New financial record'}</h3>
      {error && <p className="error-text">{error}</p>}
      <div className="form-grid">
        <label>
          Reference ID
          <input name="referenceId" value={form.referenceId} onChange={handleInputChange} />
        </label>
        <label>
          Source system
          <select name="sourceSystem" value={form.sourceSystem} onChange={handleInputChange}>
            {SOURCE_SYSTEMS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <label>
          Amount
          <input type="number" step="0.01" name="amount" value={form.amount} onChange={handleInputChange} />
        </label>
        <label>
          Currency
          <input name="currency" value={form.currency} onChange={handleInputChange} />
        </label>
        <label>
          Transaction date
          <input type="date" name="transactionDate" value={form.transactionDate} onChange={handleInputChange} />
        </label>
        <label>
          Status
          <select name="status" value={form.status} onChange={handleInputChange}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Counterparty
          <input name="counterparty" value={form.counterparty} onChange={handleInputChange} />
        </label>
        <label>
          Description
          <input name="description" value={form.description} onChange={handleInputChange} />
        </label>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Saving...' : initialValue ? 'Save changes' : 'Add record'}
        </button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
