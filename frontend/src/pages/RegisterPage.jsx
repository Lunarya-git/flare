import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Create your FLARE account</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <label>Name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>Email
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </label>
          <label>Password
            <input type="password" name="password" value={form.password} onChange={handleChange} minLength={6} required />
          </label>
          <button className="primary" type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Register'}</button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
