import { clientStore } from './clientStore';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('nexus_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    // On Netlify static hosting without backend, unmatched /api/* requests return index.html (200 OK text/html) or 404
    if (!isJson || response.status === 404 || response.status === 405 || response.status === 502) {
      console.info(`[Nexus Network] Routing ${path} to client data engine`);
      return (await clientStore.handleRoute(path, options)) as T;
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data && data.error ? data.error : `Request failed with status ${response.status}`;
      if (response.status === 401 && !path.includes('/api/auth/login') && !path.includes('/api/auth/firebase-login')) {
        // Clear token on auth failure for protected routes
        localStorage.removeItem('nexus_token');
        localStorage.removeItem('nexus_user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
      throw new ApiError(errorMessage, response.status);
    }

    return data as T;
  } catch (err: any) {
    // If it's already an explicit ApiError (e.g. 401 from server with JSON error message), check if we can fall back
    if (err instanceof ApiError && err.status === 401 && path.includes('/api/auth/login')) {
      // In case server rejects or is misconfigured, try clientStore verification
      try {
        return (await clientStore.handleRoute(path, options)) as T;
      } catch (clientErr: any) {
        throw new ApiError(clientErr.message || err.message, clientErr.status || 401);
      }
    }

    if (err instanceof ApiError) {
      throw err;
    }

    // Network error (offline or server not reachable) -> Seamless clientStore fallback
    console.info(`[Nexus Network] Server unreachable, executing ${path} via browser engine`);
    try {
      return (await clientStore.handleRoute(path, options)) as T;
    } catch (clientErr: any) {
      throw new ApiError(clientErr.message || 'Operation failed', clientErr.status || 500);
    }
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: any) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};

export function formatCurrency(amount: number, symbol = '₹'): string {
  if (isNaN(amount) || amount === null || amount === undefined) return `${symbol}0.00`;
  return `${symbol}${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
