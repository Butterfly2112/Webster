import type { LoginResponseDto } from './types';
import { refreshSession } from './http';

const API_URL = '/api/auth';

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();

    if (typeof data?.message === 'string') {
      return data.message;
    }

    if (Array.isArray(data?.message)) {
      return data.message.join(', ');
    }

    if (typeof data?.error === 'string' && typeof data?.message === 'string') {
      return `${data.error}: ${data.message}`;
    }

    if (typeof data?.error === 'string') {
      return data.error;
    }

    return 'Request failed';
  } catch {
    return 'Request failed';
  }
}

function mapAuthError(message: string, fallback: string): Error {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid credentials')) {
    return new Error('Invalid login/email or password');
  }

  if (normalized.includes('verify your email')) {
    return new Error('Please verify your email first');
  }

  return new Error(message || fallback);
}

export async function login(loginOrEmail: string, password: string): Promise<LoginResponseDto> {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ loginOrEmail, password }),
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw mapAuthError(message, 'Invalid login/email or password');
  }
  return res.json();
}

export async function register(data: {
  login: string;
  username: string;
  email: string;
  password: string;
}): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message || 'Registration failed');
  }
  return res.json();
}

export async function confirmEmail(token: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/confirm-email?token=${token}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message || 'Invalid or expired token');
  }
  return res.json();
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/reset-password-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message || 'Unable to request password reset');
  }
  return res.json();
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message || 'Unable to reset password');
  }
  return res.json();
}

export async function refresh(): Promise<LoginResponseDto> {
  return refreshSession();
}
