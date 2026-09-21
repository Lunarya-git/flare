import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import StatusBadge from './StatusBadge';
import ExceptionItem from './ExceptionItem';

const STATUSES = ['', 'open', 'investigating', 'resolved', 'dismissed'];
const SEVERITIES = ['', 'low', 'medium', 'high', 'critical'];

export default function ExceptionList() {
  const [exceptions, setExceptions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/exceptions', { params: { status, severity, search, page, limit: 10 } });
      setExceptions(res.data.data);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  }, [status, severity, search, page]);

  useEffect(() => { fetchExceptions(); }, [fetchExceptions]);

  const openDetail = useCallback(async (id) => {
    setSelectedId(id);
    const res = await api.get(`/exceptions/${id}`);
    setSelected(res.data.data);
  }, []);

  const refreshDetail = useCallback(() => {
    if (selectedId) openDetail(selectedId);
    fetchExceptions();
  }, [selectedId, openDetail, fetchExceptions]);

  return (
    <div>
      <div className="toolbar">
        <input placeholder="Search title..." value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} style={{ minWidth: 220 }} />
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select value={severity} onChange={(e) => { setPage(1); setSeverity(e.target.value); }}>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s || 'All severities'}</option>)}
        </select>
      </div>

      {selected && (
        <div style={{ marginBottom: 16 }}>
          <button className="secondary" style={{ marginBottom: 10 }} onClick={() => { setSelected(null); setSelectedId(null); }}>← Back to list</button>
          <ExceptionItem exception={selected} onChange={refreshDetail} />
        </div>
      )}

      {!selected && (
        <div className="card">
          {loading ? (
            <p className="muted">Loading exceptions...</p>
          ) : exceptions.length === 0 ? (
            <p className="muted">No exceptions match these filters. Run reconciliation from the Dashboard to generate some.</p>
          ) : (
            <table>
              <thead><tr><th>Title</th><th>Category</th><th>Severity</th><th>Status</th><th>Discrepancy</th><th>Assigned</th><th></th></tr></thead>
              <tbody>
                {exceptions.map((e) => (
                  <tr key={e._id}>
                    <td>{e.title}</td>
                    <td><StatusBadge value={e.category} /></td>
                    <td><StatusBadge value={e.severity} /></td>
                    <td><StatusBadge value={e.status} /></td>
                    <td>{e.discrepancyAmount ? `$${e.discrepancyAmount.toFixed(2)}` : '—'}</td>
                    <td>{e.assignedTo?.name || '—'}</td>
                    <td><button className="secondary" onClick={() => openDetail(e._id)}>Inspect</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="pagination">
            <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {pagination.page} of {pagination.pages || 1} · {pagination.total} exceptions</span>
            <button className="secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
