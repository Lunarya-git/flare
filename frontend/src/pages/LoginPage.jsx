import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('analyst@flare.demo');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>FLARE</h2>
        <p className="muted">Financial Ledger Anomaly &amp; Reconciliation Engine</p>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <label>Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button className="primary" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>No account? <Link to="/register">Register</Link></p>
        <p className="muted" style={{ marginTop: 4, fontSize: '0.78rem' }}>Demo login (after seeding): analyst@flare.demo / password123</p>
      </div>
    </div>
  );
}
