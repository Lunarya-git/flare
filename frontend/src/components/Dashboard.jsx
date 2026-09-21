import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../api/axios';

const COLORS = ['#4f7cff', '#22c1a4', '#f2a93b', '#ef4d5e', '#9b6bff'];

// Backed entirely by real database data via GET /api/dashboard/summary -
// no mock numbers, per the assignment's dashboard requirement.
export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/summary');
      setSummary(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleRunReconciliation = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await api.post('/reconciliation/run');
      setRunResult(res.data.data);
      await fetchSummary();
    } finally {
      setRunning(false);
    }
  };

  if (loading || !summary) return <p className="muted">Loading dashboard...</p>;

  const metrics = [
    { label: 'Total transactions', value: summary.totalTransactions },
    { label: 'Reconciled', value: summary.reconciledTransactions },
    { label: 'Unmatched', value: summary.unmatchedTransactions },
    { label: 'In exception', value: summary.exceptionTransactions },
    { label: 'Open exceptions', value: summary.openExceptions },
    { label: 'Resolved exceptions', value: summary.resolvedExceptions },
    { label: 'Total discrepancy', value: `$${summary.totalDiscrepancyAmount.toFixed(2)}` },
  ];

  return (
    <div>
      <div className="toolbar">
        <button className="primary" onClick={handleRunReconciliation} disabled={running}>
          {running ? 'Running reconciliation...' : 'Run reconciliation pass'}
        </button>
        {runResult && (
          <span className="muted">
            Scanned {runResult.scanned} · {runResult.exactMatches} exact matches · {runResult.exceptions} exceptions created
          </span>
        )}
      </div>

      <div className="grid-metrics">
        {metrics.map((m) => (
          <div className="metric-card" key={m.label}>
            <div className="label">{m.label}</div>
            <div className="value">{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Reconciliation runs (last 30 days)</h3>
          {summary.reconciliationTrend.length === 0 ? (
            <p className="muted">No reconciliation runs yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary.reconciliationTrend}>
                <XAxis dataKey="date" stroke="#9aa7c2" fontSize={11} />
                <YAxis stroke="#9aa7c2" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a2438', border: '1px solid #263049' }} />
                <Bar dataKey="runs" fill="#4f7cff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Exceptions by category</h3>
          {summary.exceptionsByCategory.length === 0 ? (
            <p className="muted">No exceptions yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={summary.exceptionsByCategory} dataKey="count" nameKey="category" outerRadius={90} label>
                  {summary.exceptionsByCategory.map((entry, i) => (
                    <Cell key={entry.category} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: '#1a2438', border: '1px solid #263049' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
