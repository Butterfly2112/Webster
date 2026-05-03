import { useAuthStore } from '../store/auth';
import type { LoginResponseDto } from './types';

const API_URL = '/api/auth';

let refreshPromise: Promise<LoginResponseDto> | null = null;

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

async function refreshSession(): Promise<LoginResponseDto> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error((await readErrorMessage(res)) || 'Unable to refresh session');
        }

        return res.json() as Promise<LoginResponseDto>;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function customFetch(
  input: RequestInfo | URL,
  options: RequestInit = {},
  config: { auth?: boolean; retryOnUnauthorized?: boolean } = {},
): Promise<Response> {
  const shouldAttachAuth = config.auth ?? true;
  const shouldRetryOnUnauthorized = config.retryOnUnauthorized ?? shouldAttachAuth;

  const headers = new Headers(options.headers);
  const accessToken = localStorage.getItem('accessToken');

  if (shouldAttachAuth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const requestInit: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials ?? 'include',
  };

  let response = await fetch(input, requestInit);

  if (response.status !== 401 || !shouldRetryOnUnauthorized || !shouldAttachAuth) {
    return response;
  }

  try {
    const data = await refreshSession();
    useAuthStore.getState().setAuth(data.user, data.access_token);

    headers.set('Authorization', `Bearer ${data.access_token}`);
    response = await fetch(input, {
      ...options,
      headers,
      credentials: options.credentials ?? 'include',
    });
  } catch (error) {
    useAuthStore.getState().clearAuth();
    throw error;
  }

  return response;
}

export { refreshSession };