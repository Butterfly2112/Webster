import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';

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
    <form onSubmit={submit}>
      <div>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <input
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button type="submit" disabled={mutation.isPending}>Reset password</button>
      {error && <div>{error}</div>}
    </form>
  );
}
