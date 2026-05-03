import { useEffect } from 'react';

function ConfirmEmailRedirect() {
  const search = window.location.search;
  useEffect(() => {
    window.location.replace(`/email-confirmed${search}`);
  }, [search]);
  return null;
}
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import { refreshSession } from './api/http';
import Login from './pages/Login';
import Register from './pages/Register';
import GoogleLogin from './pages/GoogleLogin';
import EmailConfirmed from './pages/EmailConfirmed';
import ResetPasswordRequest from './pages/ResetPasswordRequest';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';

const queryClient = new QueryClient();

export default function App() {
  const user = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrate);
  const setAuth = useAuthStore(s => s.setAuth);
  const clearAuth = useAuthStore(s => s.clearAuth);
  
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    const keepSessionAlive = async () => {
      try {
        const data = await refreshSession();

        if (active) {
          setAuth(data.user, data.access_token);
        }
      } catch {
        if (active) {
          clearAuth();
        }
      }
    };

    void keepSessionAlive();

    const intervalId = window.setInterval(keepSessionAlive, 14 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user, setAuth, clearAuth]);
  
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div>
          <nav style={{ marginBottom: 20 }}>
            <Link to="/login"><button>Login</button></Link>
            <Link to="/register"><button>Register</button></Link>
            <Link to="/google-login"><button>Google Login</button></Link>
            {user && <Link to="/home"><button>Home</button></Link>}
          </nav>
          <Routes>
            {user ? (
              <>
                <Route path="/home" element={<Home />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </>
            ) : (
              <>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/reset-password-request" element={<ResetPasswordRequest />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/email-confirmed" element={<EmailConfirmed />} />
                <Route path="/confirm-email" element={<ConfirmEmailRedirect />} />
                <Route path="/google-login" element={<GoogleLogin />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </>
            )}
          </Routes>
        </div>
      </Router>
    </QueryClientProvider>
  );
}
