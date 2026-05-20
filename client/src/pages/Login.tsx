import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login, refresh } from '../api/auth';
import type { User } from '../api/types';
import { useAuthStore } from '../store/auth';
import Footer from '../components/Footer';
import Header from '../components/Header';
import GoogleLoginButton from './GoogleLoginButton';

type GoogleTokenPayload = {
  sub?: number | string;
  login?: string;
  email?: string;
};

function decodeGoogleToken(token: string): User | null {
  try {
    const payloadPart = token.split('.')[1];

    if (!payloadPart) {
      return null;
    }

    const normalizedPayload = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    const payload = JSON.parse(atob(paddedPayload)) as GoogleTokenPayload;
    const email = payload.email ?? '';
    const login = payload.login ?? email.split('@')[0] ?? 'google-user';

    return {
      id: typeof payload.sub === 'string' ? Number(payload.sub) : payload.sub ?? 0,
      login,
      username: login,
      email,
      avatar_url: '',
      created_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export default function Login() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledGoogleTokenRef = useRef<string | null>(null);
  const [loginOrEmail, setLoginOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => {
    const callbackError = searchParams.get('error');
    return callbackError ? decodeURIComponent(callbackError) : '';
  });
  const isGoogleRedirect = Boolean(searchParams.get('token'));

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      return;
    }

    if (handledGoogleTokenRef.current === token) {
      return;
    }

    handledGoogleTokenRef.current = token;

    const fallbackUser = decodeGoogleToken(token);

    if (!fallbackUser) {
      window.setTimeout(() => {
        setError('Google login failed. Please try again.');
      }, 0);
      return;
    }

    setAuth(fallbackUser, token);
    navigate('/home', { replace: true });

    refresh()
      .then((data) => {
        setAuth(data.user, data.access_token);
      })
      .catch(() => {
        // Keep the access token from the redirect when refresh-cookie is not ready.
      });
  }, [navigate, searchParams, setAuth]);


  const mutation = useMutation({
    mutationFn: () => login(loginOrEmail, password),
    onSuccess: (data) => {
      setAuth(data.user, data.access_token);
      navigate('/home');
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'Unable to log in. Please try again.');
    },
  });

  return (
      <div className="app">
        <Header />
        <main className="login-page">
          {/* ЛІВА ЧАСТИНА: Привітання та Фото */}
          <div className="login-left">
            <div className="welcome-content">
              <h1>Welcome to Brawy!</h1>
              <p>Your ultimate creative platform for building web magic. Start your journey today!</p>
            </div>
          </div>

          {/* ПРАВА ЧАСТИНА: Форма логіну */}
          <div className="login-right">
            <form className="login-form" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
              <h2>Sign In</h2>
              {isGoogleRedirect && <div className="status-msg">Signing in with Google...</div>}

              <div className="input-group">
                <input
                    placeholder="Login or Email"
                    value={loginOrEmail}
                    onChange={e => setLoginOrEmail(e.target.value)}
                />
              </div>

              <div className="input-group">
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="button-agree" disabled={mutation.isPending}>
                {mutation.isPending ? 'Logging in...' : 'Login'}
              </button>

              <div className="divider">or</div>

              <GoogleLoginButton text="Login with Google" />

              <div className="form-footer">
                <Link to="/reset-password-request">Forgot password?</Link>
                <span>Don't have an account? <Link to="/register">Register</Link></span>
              </div>

              {error && <div className="error-msg">{error}</div>}
            </form>
          </div>
        </main>
        <Footer />
      </div>
  );
}
