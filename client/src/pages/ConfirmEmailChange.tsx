import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { customFetch } from '../api/http';
import { useAuthStore } from '../store/auth';

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

export default function ConfirmEmailChange() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
    const [message, setMessage] = useState('');

    const confirmedTokenRef = useRef<string | null>(null);

    const pendingAuthRef = useRef<{ user: any; token: string } | null>(null);

    const user = useAuthStore(s => s.user);

    const setResult = (nextStatus: 'success' | 'error', nextMessage: string) => {
        setStatus(nextStatus);
        setMessage(nextMessage);
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
            setResult('success', 'Your email has already been successfully updated.');
            return;
        }

        const confirmChange = async () => {
            try {
                const response = await customFetch(`/api/user/confirm-email-change?token=${token}`, {
                    method: 'PATCH',
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to update email.');
                }

                const data = await response.json();
                setConfirmedToken(token);

                setResult('success', data.message || 'Your email has been successfully updated.');

                try {
                    const profileRes = await customFetch('/api/user/profile');
                    if (profileRes.ok) {
                        const updatedUser = await profileRes.json();
                        const currentToken = localStorage.getItem('accessToken') || '';
                        pendingAuthRef.current = { user: updatedUser, token: currentToken };
                    }
                } catch (e) {
                }

            } catch (err: any) {
                if (getConfirmedTokens().includes(token)) {
                    setResult('success', 'Your email has been successfully updated.');
                    return;
                }
                setResult('error', err.message || 'Invalid or expired token.');
            }
        };

        confirmChange();
    }, [searchParams]);

    const handleContinueClick = () => {
        if (pendingAuthRef.current) {
            useAuthStore.getState().setAuth(pendingAuthRef.current.user, pendingAuthRef.current.token);
        }
    };

    const redirectLink = user ? '/home' : '/login';
    const redirectText = user ? 'Go to Projects' : 'Go to Login';

    return (
        <div className="login-page" style={{ justifyContent: 'center', background: 'var(--main-bg)', padding: '20px', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
            <div className="modal-content" style={{ textAlign: 'center', width: '100%', maxWidth: '450px', margin: 'auto' }}>

                {status === 'pending' && (
                    <div style={{ padding: '20px 0' }}>
                        <div className="feature-icon" style={{ margin: '0 auto 20px auto', animation: 'fadeIn 1s infinite alternate' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                            </svg>
                        </div>
                        <h2 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>Updating Email...</h2>
                        <p style={{ color: 'var(--text-light)', margin: 0 }}>Please wait while we verify your new email.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                        <div className="feature-icon" style={{ margin: '0 auto 20px auto', background: '#dcfce7', color: '#16a34a' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h2 style={{ color: 'var(--primary-color)', marginBottom: '10px', fontSize: '24px', fontWeight: 700 }}>Email Updated!</h2>
                        <p style={{ color: 'var(--text-light)', marginBottom: '30px', lineHeight: '1.6' }}>{message}</p>

                        <Link
                            to={redirectLink}
                            onClick={handleContinueClick}
                            className="button-agree"
                            style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
                        >
                            {redirectText}
                        </Link>
                    </div>
                )}

                {status === 'error' && (
                    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
                        <div className="feature-icon" style={{ margin: '0 auto 20px auto', background: 'var(--error-bg)', color: 'var(--error-color)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </div>
                        <h2 style={{ color: 'var(--error-color)', marginBottom: '15px', fontSize: '24px', fontWeight: 700 }}>Update Failed</h2>
                        <div className="error-msg" style={{ marginBottom: '30px' }}>
                            {message}
                        </div>
                        <Link
                            to={redirectLink}
                            onClick={handleContinueClick}
                            className="button-secondary"
                            style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
                        >
                            Continue
                        </Link>
                    </div>
                )}

            </div>
        </div>
    );
}