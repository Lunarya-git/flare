import { useState } from 'react';
import StatusBadge from './StatusBadge';
import api from '../api/axios';

const STATUSES = ['open', 'investigating', 'resolved', 'dismissed'];

// Detail panel for one exception: shows the related transactions and
// the signals that produced it, plus actions to assign / change status / add notes.
export default function ExceptionItem({ exception, onChange }) {
  const [note, setNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);

  const recon = exception.reconciliation;

  const changeStatus = async (status) => {
    setSaving(true);
    try {
      await api.patch(`/exceptions/${exception._id}/status`, { status, resolution });
      onChange();
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.post(`/exceptions/${exception._id}/notes`, { text: note });
      setNote('');
      onChange();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: '0 0 6px' }}>{exception.title}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <StatusBadge value={exception.category} />
            <StatusBadge value={exception.severity} />
            <StatusBadge value={exception.status} />
          </div>
        </div>
        <div className="muted">Discrepancy: {exception.discrepancyAmount ? `$${exception.discrepancyAmount.toFixed(2)}` : '—'}</div>
      </div>

      {exception.relatedTransactions?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ marginBottom: 6 }}>Related records</p>
          <table>
            <thead><tr><th>Reference</th><th>Source</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {exception.relatedTransactions.map((t) => (
                <tr key={t._id}>
                  <td>{t.referenceId}</td><td>{t.sourceSystem.replace(/_/g, ' ')}</td>
                  <td>{t.currency} {t.amount.toFixed(2)}</td>
                  <td>{new Date(t.transactionDate).toLocaleDateString()}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recon?.signals && (
        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ marginBottom: 6 }}>Matching signals (confidence: {recon.confidenceScore}%)</p>
          <div className="signals-grid">
            <span>Reference match: {String(recon.signals.referenceMatch)}</span>
            <span>Amount match: {String(recon.signals.amountMatch)} {recon.signals.amountDeltaPct != null ? `(Δ${(recon.signals.amountDeltaPct * 100).toFixed(2)}%)` : ''}</span>
            <span>Date match: {String(recon.signals.dateMatch)} {recon.signals.dateDeltaDays != null ? `(Δ${recon.signals.dateDeltaDays}d)` : ''}</span>
            <span>Status match: {String(recon.signals.statusMatch)}</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <p className="muted" style={{ marginBottom: 6 }}>Investigation notes</p>
        {exception.notes?.length ? exception.notes.map((n) => (
          <div key={n._id} className="note">
            <div className="meta">{n.author?.name || 'Unknown'} · {new Date(n.createdAt).toLocaleString()}</div>
            {n.text}
          </div>
        )) : <p className="muted">No notes yet.</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input style={{ flex: 1 }} placeholder="Add an investigation note..." value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="secondary" disabled={saving} onClick={addNote}>Add note</button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted">Change status:</span>
        {STATUSES.map((s) => (
          <button key={s} className="secondary" disabled={saving || exception.status === s} onClick={() => changeStatus(s)}>{s}</button>
        ))}
        <input placeholder="Resolution note (for resolve/dismiss)" value={resolution} onChange={(e) => setResolution(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
      </div>
    </div>
  );
}
