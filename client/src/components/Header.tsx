import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useMutation } from "@tanstack/react-query";
import { customFetch } from '../api/http';
import type { User } from "../api/types.ts";

export interface SafeUserDto {
    id: number;
    login: string;
    username: string;
    email: string;
    avatar_url: string | null;
    created_at: string;
}

export default function Header() {
    const user = useAuthStore(s => s.user);
    const clearAuth = useAuthStore(s => s.clearAuth);
    const navigate = useNavigate();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [newUsername, setNewUsername] = useState(user?.username || '');
    const [newEmail, setNewEmail] = useState(user?.email || '');
    const [newAvatar, setNewAvatar] = useState(user?.avatar_url || '');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    const [updateError, setUpdateError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleLogout = () => {
        clearAuth();
        navigate('/login');
    };

    const openEditModal = () => {
        if (user) {
            setNewUsername(user.username);
            setNewEmail(user.email || '');
            setNewAvatar(user.avatar_url || '');
            setAvatarFile(null);

            // Очищаємо старі повідомлення при новому відкритті
            setUpdateError('');
            setSuccessMessage('');

            setIsModalOpen(true);
        }
    };

    const mutation = useMutation({
        mutationFn: async () => {
            // Очищаємо помилки перед новим запитом
            setUpdateError('');
            setSuccessMessage('');

            const formData = new FormData();
            formData.append('username', newUsername);
            formData.append('email', newEmail);

            if (avatarFile) {
                formData.append('file', avatarFile);
            }

            const response = await customFetch('/api/user/profile', {
                method: 'PATCH',
                body: formData,
            });

            if (!response.ok) {
                let errorMessage = 'Update failed';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                }
                throw new Error(Array.isArray(errorMessage) ? errorMessage[0] : errorMessage);
            }

            return response.json() as Promise<SafeUserDto>;
        },
        onSuccess: (updatedUser: SafeUserDto) => {
            const currentToken = localStorage.getItem('accessToken') || '';

            const userForStore = {
                ...updatedUser,
                avatar_url: updatedUser.avatar_url ?? ''
            } as unknown as User;

            useAuthStore.getState().setAuth(userForStore, currentToken);

            // Визначаємо текст повідомлення залежно від того, чи змінили пошту
            if (newEmail !== user?.email) {
                setSuccessMessage('Profile updated! Verification email sent to your new address.');
            } else {
                setSuccessMessage('Profile successfully updated!');
            }

            // Даємо користувачу 2.5 секунди прочитати повідомлення перед закриттям
            setTimeout(() => {
                setIsModalOpen(false);
                setSuccessMessage('');
            }, 2500);

        },
        onError: (e: any) => {
            setSuccessMessage(''); // Прибираємо успіх, якщо є помилка
            setUpdateError(e.message || 'Update failed');
        }
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (user) {
            mutation.mutate();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                setUpdateError("File is too large (max 2MB)");
                return;
            }

            setAvatarFile(file);

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setNewAvatar(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <header className="header">
            <div className="header-container">
                <div className="header-left">
                    <Link to="/" className="logo-block">
                        <img src="/logo.png" alt="logo" className="logo-img" />
                        <span className="logo-text">Brawy</span>
                    </Link>
                </div>

                <div className="header-center">
                    <nav className="nav-links">
                        <Link to="/templates">Templates</Link>
                        <Link to="/home">Projects</Link>
                        <Link to="/about">About us</Link>
                    </nav>
                </div>

                <div className="header-right">
                    {user ? (
                        <div
                            className="user-dropdown-container"
                            onMouseEnter={() => setIsDropdownOpen(true)}
                            onMouseLeave={() => setIsDropdownOpen(false)}
                        >
                            <div className="user-info-trigger">
                                <img
                                    src={user.avatar_url || '/default-avatar.png'}
                                    alt="avatar"
                                    className="avatar"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                                />
                                <span className="username-text">{user.login}</span>
                            </div>

                            {isDropdownOpen && (
                                <div className="dropdown-menu">
                                    <button onClick={openEditModal} className="dropdown-item">
                                        <img src="/edit-icon.png" alt="" className="dropdown-icon" />
                                        <span>Edit Profile</span>
                                    </button>

                                    <button onClick={handleLogout} className="dropdown-item logout-item">
                                        <img src="/logout-icon.png" alt="" className="dropdown-icon" />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Edit Profile</h2>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
                        </div>

                        <form onSubmit={handleSave} className="edit-profile-form">
                            <div className="avatar-edit-section">
                                <img
                                    style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }}
                                    src={newAvatar || '/default-avatar.png'}
                                    alt="Preview"
                                    className="avatar-preview-big"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
                                />

                                <div className="file-input-container">
                                    <label htmlFor="avatar-upload" className="button-secondary">
                                        Choose Photo
                                    </label>
                                    <input
                                        id="avatar-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />
                                </div>
                            </div>

                            {/* Логін (Тільки для читання) */}
                            <div className="input-group" style={{ padding: '15px 0', borderTop: '1px solid #e2e8f0' }}>
                                <label>Login (Cannot be changed)</label>
                                <input
                                    type="text"
                                    value={user?.login || ''}
                                    disabled
                                    style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }}
                                />
                            </div>

                            {/* Ім'я */}
                            <div className="input-group" style={{ paddingBottom: '15px' }}>
                                <label>Username</label>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    required
                                    minLength={3}
                                />
                            </div>

                            {/* Пошта */}
                            <div className="input-group" style={{ paddingBottom: '15px' }}>
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    required
                                />
                            </div>

                            {/* БЛОК ПОВІДОМЛЕНЬ ВНИЗУ */}
                            <div style={{ minHeight: '24px', marginBottom: '15px', textAlign: 'center', fontSize: '14px', fontWeight: '500' }}>
                                {updateError && <div style={{ color: '#ef4444' }}>{updateError}</div>}
                                {successMessage && <div style={{ color: '#10b981' }}>{successMessage}</div>}
                            </div>

                            <div className="modal-actions"
                                 style={{
                                     display: 'flex',
                                     justifyContent: 'space-between',
                                     width: '100%'
                                 }}>
                                <button
                                    type="submit"
                                    className="button-agree"
                                    disabled={mutation.isPending || !!successMessage}
                                >
                                    {mutation.isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    className="button-disagree"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    {successMessage ? 'Close' : 'Cancel'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </header>
    );
}