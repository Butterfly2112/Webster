import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { confirmEmail } from '../api/auth';

const CONFIRMED_TOKENS_KEY = 'confirmedEmailTokens';

function getConfirmedTokens(): string[] {
  try {
    const raw = localStorage.getItem(CONFIRMED_TOKENS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function setConfirmedToken(token: string) {
  const tokens = new Set(getConfirmedTokens());
  tokens.add(token);
  localStorage.setItem(CONFIRMED_TOKENS_KEY, JSON.stringify(Array.from(tokens)));
}

export default function EmailConfirmed() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');
  const confirmedTokenRef = useRef<string | null>(null);

  const setResult = (nextStatus: 'success' | 'error', nextMessage: string) => {
    window.setTimeout(() => {
      setStatus(nextStatus);
      setMessage(nextMessage);
    }, 0);
  };

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setResult('error', 'No token provided.');
      return;
    }

    if (confirmedTokenRef.current === token) {
      return;
    }

    confirmedTokenRef.current = token;

    if (getConfirmedTokens().includes(token)) {
      setResult('success', 'Your account has already been successfully confirmed.');
      return;
    }

    confirmEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message || 'Your account has been successfully confirmed.');
        setConfirmedToken(token);
      })
      .catch((err) => {
        if (getConfirmedTokens().includes(token)) {
          setStatus('success');
          setMessage('Your account has already been successfully confirmed.');
          return;
        }

        setStatus('error');
        setMessage(
          err instanceof Error && err.message.toLowerCase().includes('invalid token')
            ? 'Your account has already been successfully confirmed.'
            : err instanceof Error
              ? err.message
              : 'Invalid or expired token.',
        );
      });
  }, [searchParams]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      {status === 'pending' && <p>Confirming your email...</p>}
      {status === 'success' && <>
        <h1>Email Confirmed</h1>
        <p>{message}</p>
        <Link to="/login" style={{ marginTop: 20, color: '#1976d2', textDecoration: 'underline' }}>Go to Login</Link>
      </>}
      {status === 'error' && <>
        <h1>Email Confirmation Failed</h1>
        <p>{message}</p>
        <Link to="/login" style={{ marginTop: 20, color: '#1976d2', textDecoration: 'underline' }}>Go to Login</Link>
      </>}
    </div>
  );
}
