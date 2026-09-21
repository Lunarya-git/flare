import { useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout title="CSV Import">
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Upload a transaction CSV</h3>
        <p className="muted">
          Pipeline: upload → validation → parsing → normalization → duplicate detection → database insertion → import summary.
          Expected columns: <code>referenceId, sourceSystem, amount, transactionDate</code> (required),
          plus optional <code>currency, description, counterparty, status</code>.
        </p>
        <form onSubmit={handleUpload} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
          <button className="primary" type="submit" disabled={!file || uploading}>
            {uploading ? 'Uploading...' : 'Import CSV'}
          </button>
        </form>
        {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
      </div>

      {result && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Import summary</h3>
          <div className="grid-metrics">
            <div className="metric-card"><div className="label">Total rows</div><div className="value">{result.totalRows}</div></div>
            <div className="metric-card"><div className="label">Inserted</div><div className="value">{result.inserted}</div></div>
            <div className="metric-card"><div className="label">Invalid</div><div className="value">{result.invalid}</div></div>
            <div className="metric-card"><div className="label">Duplicates</div><div className="value">{result.duplicates}</div></div>
          </div>

          {result.invalidRows.length > 0 && (
            <>
              <p className="muted">Invalid rows</p>
              <ul>
                {result.invalidRows.map((r) => (
                  <li key={r.row} className="error-text">Row {r.row}: {r.errors.join('; ')}</li>
                ))}
              </ul>
            </>
          )}

          {result.duplicateRows.length > 0 && (
            <>
              <p className="muted">Duplicate rows skipped</p>
              <ul>
                {result.duplicateRows.map((r) => (
                  <li key={r.row} className="muted">Row {r.row} ({r.referenceId}): {r.reason.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
