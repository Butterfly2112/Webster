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
import "./main.css";
import Login from './pages/Login';
import Register from './pages/Register';
import GoogleLogin from './pages/GoogleLoginButton.tsx';
import EmailConfirmed from './pages/EmailConfirmed';
import ResetPasswordRequest from './pages/ResetPasswordRequest';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import About from './pages/About';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

const queryClient = new QueryClient();

export default function App() {
  const user = useAuthStore(s => s.user);
  const hydrate = useAuthStore(s => s.hydrate);
  
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    const keepSessionAlive = async () => {
      if (!active) return;
      
      try {
        const data = await refreshSession();

        if (active) {
          useAuthStore.getState().setAuth(data.user, data.access_token);
        }
      } catch (error) {
        console.log('[SESSION] Failed to refresh token', error);
        if (active) {
          useAuthStore.getState().clearAuth();
        }
      }
    };

    const intervalId = window.setInterval(keepSessionAlive, 14 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [user]);
  
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div>
          <Routes>
            {user ? (
              <>
                <Route path="/home" element={<Home />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
                <Route path="/about" element={<About />} />
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
