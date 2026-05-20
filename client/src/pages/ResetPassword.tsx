import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(() => (token ? '' : 'Missing token'));

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: () => navigate('/login'),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'Reset failed'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!token) return setError('Missing token');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    mutation.mutate();
  }

  return (
      <div className="app">
        <Header />

        <main className="login-page">
          {/* ЛІВА ЧАСТИНА */}
          <div className="login-left">
            <div className="welcome-content">
              <h1>Set New Password</h1>
              <p>You're almost there! Choose a strong password to keep your Brawy account secure.</p>
            </div>
          </div>

          {/* ПРАВА ЧАСТИНА: Форма скидання */}
          <div className="login-right">
            <form className="login-form" onSubmit={submit}>
              <h2>New Credentials</h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                Please enter and confirm your new password below.
              </p>

              <div className="input-group">
                <input
                    type="password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
              </div>

              <div className="input-group">
                <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                />
              </div>

              <button type="submit" className="button-agree" disabled={mutation.isPending}>
                {mutation.isPending ? 'Updating...' : 'Reset password'}
              </button>

              <div className="form-footer">
                <Link to="/login">Cancel and return to Login</Link>
              </div>

              {/* Виведення помилок */}
              {error && <div className="error-msg" style={{ marginTop: '10px' }}>{error}</div>}
            </form>
          </div>
        </main>

        <Footer />
      </div>
  );
}