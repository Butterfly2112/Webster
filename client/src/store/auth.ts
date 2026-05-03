import { create } from 'zustand';

interface User {
  id: number;
  login: string;
  username: string;
  email: string;
  avatar_url: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', accessToken);
    set({ user, accessToken });
  },
  clearAuth: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null });
  },
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null });
  },
  hydrate: () => {
    const user = localStorage.getItem('user');
    const accessToken = localStorage.getItem('accessToken');
    if (user && accessToken) {
      set({ user: JSON.parse(user), accessToken });
    }
  },
}));
