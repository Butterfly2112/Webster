import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useMutation } from "@tanstack/react-query";
import { customFetch } from '../api/http';
import type {User} from "../api/types.ts";

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
    const [newAvatar, setNewAvatar] = useState(user?.avatar_url || '');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    const [updateError, setUpdateError] = useState('');

    const handleLogout = () => {
        clearAuth();
        navigate('/login');
    };

    const openEditModal = () => {
        if (user) {
            setNewUsername(user.username);
            setNewAvatar(user.avatar_url || '');
            setAvatarFile(null);
            setUpdateError('');
            setIsModalOpen(true);
        }
    };

    const mutation = useMutation({
        mutationFn: async () => {
            const formData = new FormData();
            formData.append('username', newUsername);

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
            setIsModalOpen(false);
            setUpdateError('');
        },
        onError: (e: any) => {
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
                        <span className="logo-text">Webster</span>
                    </Link>
                </div>

                <div className="header-center">
                    <nav className="nav-links">
                        <Link to="/templates">Templates</Link>
                        <Link to="/projects">My projects</Link>
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
                                <span className="username-text">{user.username}</span>
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


                            <div className="input-group" style={{  padding: '15px 0', borderTop: '1px solid #e2e8f0' }}>
                                <label>Login</label>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    required
                                    minLength={3}
                                />
                            </div>

                            {updateError && <div className="error-msg" style={{color: 'red', marginBottom: '12px'}}>{updateError}</div>}

                            <div className="modal-actions"
                                 style={{
                                     display: 'flex',
                                     justifyContent: 'space-between',
                                     width: '100%',
                                     marginTop: '20px'
                                 }}>
                                <button
                                    type="submit"
                                    className="button-agree"
                                    disabled={mutation.isPending}

                                >
                                    {mutation.isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    className="button-disagree"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </header>
    );
}