import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { requestPasswordReset } from '../api/auth';

export default function ResetPasswordRequest() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const tokenFromUrl = searchParams.get('token');

  useEffect(() => {
    if (!tokenFromUrl) {
      return;
    }

    navigate(`/reset-password?token=${encodeURIComponent(tokenFromUrl)}`, {
      replace: true,
    });
  }, [navigate, tokenFromUrl]);

  const mutation = useMutation({
    mutationFn: () => requestPasswordReset(email),
    onSuccess: (data) => setMessage(data.message || 'Check your email'),
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : 'Request failed'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button type="submit" disabled={mutation.isPending}>Send reset link</button>
      {message && <div>{message}</div>}
    </form>
  );
}
