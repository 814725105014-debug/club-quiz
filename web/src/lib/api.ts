export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
  raw?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
      signal: options.signal,
    });
  } catch (err) {
    throw new ApiError(0, 'Network unreachable. Check your connection and try again.', 'network_error', err);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (options.raw || !contentType.includes('application/json')) {
    const text = await response.text();
    if (!response.ok) throw new ApiError(response.status, text || response.statusText, 'http_error');
    return text as unknown as T;
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; code?: string; details?: unknown }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error || payload?.message || response.statusText || 'Request failed.',
      payload?.code || 'http_error',
      payload?.details,
    );
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, token?: string, signal?: AbortSignal) => request<T>(path, { token, signal }),
  post: <T>(path: string, body?: unknown, token?: string) => request<T>(path, { method: 'POST', body, token }),
  patch: <T>(path: string, body?: unknown, token?: string) => request<T>(path, { method: 'PATCH', body, token }),
  put: <T>(path: string, body?: unknown, token?: string) => request<T>(path, { method: 'PUT', body, token }),
  del: <T>(path: string, body?: unknown, token?: string) => request<T>(path, { method: 'DELETE', body, token }),
  text: (path: string, token?: string) => request<string>(path, { token, raw: true }),
};

/** Downloads an authenticated admin file (CSV export etc.) through the API. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, payload?.error || 'Download failed.', payload?.code);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
