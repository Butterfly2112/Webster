import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { register } from '../api/auth';
import Header from '../components/Header';
import Footer from '../components/Footer';
import GoogleLoginButton from './GoogleLoginButton';

export default function Register() {
    const [login, setLogin] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const mutation = useMutation({
        mutationFn: () => register({ login, username, email, password }),
        onSuccess: (data) => {
            setMessage(data.message);
            setError(''); // Очищуємо помилку при успіху
        },
        onError: (e: unknown) => {
            setMessage(''); // Очищуємо повідомлення успіху
            setError(e instanceof Error ? e.message : 'Unable to register. Please try again.');
        },
    });

    return (
        <div className="app">
            <Header />

            <main className="login-page">
                {/* ЛІВА ЧАСТИНА: Привітання та Фото (аналогічно логіну) */}
                <div className="login-left">
                    <div className="welcome-content">
                        <h1>Join Brawy!</h1>
                        <p>Create your account and start building amazing web projects with our powerful editor.</p>
                        {/* Тут можна додати інше фото або залишити той самий стиль */}
                    </div>
                </div>

                {/* ПРАВА ЧАСТИНА: Форма реєстрації */}
                <div className="login-right">
                    <form className="login-form" onSubmit={e => { e.preventDefault(); setError(''); mutation.mutate(); }}>
                        <h2>Create Account</h2>

                        <div className="input-group">
                            <input
                                placeholder="Login"
                                value={login}
                                onChange={e => setLogin(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <input
                                placeholder="Username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="button-agree" disabled={mutation.isPending}>
                            {mutation.isPending ? 'Processing...' : 'Register'}
                        </button>

                        <div className="divider">or</div>

                        <GoogleLoginButton text="Sign up with Google" />

                        <div className="form-footer">
                            <span>Already have an account? <Link to="/login">Sign In</Link></span>
                        </div>

                        {/* Виведення статусів */}
                        {message && <div className="status-msg" style={{ color: '#28a745', background: '#e6ffed', padding: '10px', borderRadius: '5px', textAlign: 'center' }}>{message}</div>}
                        {error && <div className="error-msg">{error}</div>}
                    </form>
                </div>
            </main>

            <Footer />
        </div>
    );
}