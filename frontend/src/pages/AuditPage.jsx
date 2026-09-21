import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit', { params: { action: action || undefined, page, limit: 25 } });
      setLogs(res.data.data);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  }, [action, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <Layout title="Audit Trail">
      <div className="toolbar">
        <select value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }}>
          <option value="">All actions</option>
          <option value="user_registered">user_registered</option>
          <option value="user_login">user_login</option>
          <option value="record_created">record_created</option>
          <option value="record_updated">record_updated</option>
          <option value="record_deleted">record_deleted</option>
          <option value="records_imported">records_imported</option>
          <option value="reconciliation_run">reconciliation_run</option>
          <option value="exception_created">exception_created</option>
          <option value="exception_assigned">exception_assigned</option>
          <option value="exception_status_changed">exception_status_changed</option>
          <option value="exception_note_added">exception_note_added</option>
          <option value="exception_resolved">exception_resolved</option>
        </select>
      </div>
      <div className="card">
        {loading ? (
          <p className="muted">Loading audit log...</p>
        ) : logs.length === 0 ? (
          <p className="muted">No audit events yet.</p>
        ) : (
          <table>
            <thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Performed by</th><th>Metadata</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.action}</td>
                  <td>{l.entityType}</td>
                  <td>{l.performedBy?.name || '—'}</td>
                  <td><code style={{ fontSize: '0.78rem' }}>{JSON.stringify(l.metadata)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="pagination">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {pagination.page} of {pagination.pages || 1} · {pagination.total} events</span>
          <button className="secondary" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </Layout>
  );
}
