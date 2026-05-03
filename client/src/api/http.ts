import { useAuthStore } from '../store/auth';
import type { LoginResponseDto } from './types';

const API_URL = '/api/auth';

let isRefreshing = false;

let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

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
  const res = await fetch(`${API_URL}/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error((await readErrorMessage(res)) || 'Unable to refresh session');
  }

  const data = (await res.json()) as LoginResponseDto;
  return data;
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

  if (!isRefreshing) {
    isRefreshing = true;

    try {
      const data = await refreshSession();

      useAuthStore.getState().setAuth(data.user, data.access_token);
      processQueue(null, data.access_token);

      headers.set('Authorization', `Bearer ${data.access_token}`);
      response = await fetch(input, {
        ...options,
        headers,
        credentials: options.credentials ?? 'include',
      });
    } catch (error) {
      useAuthStore.getState().clearAuth();
      processQueue(error as Error, null);
    } finally {
      isRefreshing = false;
    }
  } else {
    const newToken = await new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });

    headers.set('Authorization', `Bearer ${newToken}`);
    response = await fetch(input, {
      ...options,
      headers,
      credentials: options.credentials ?? 'include',
    });
  }

  return response;
}

export { refreshSession };