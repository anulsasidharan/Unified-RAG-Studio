// In the browser, use same-origin `/api/*` so `next.config.js` rewrites proxy to the FastAPI
// backend. Calling `http://localhost:8000` directly breaks CORS when the app is opened on
// `127.0.0.1` or another host not listed in the API's `cors_origins`.
const API_BASE =
  typeof window !== 'undefined'
    ? ''
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly data?: unknown
  ) {
    super(`API error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function request<TResponse, TBody = unknown>(
  path: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const { method = 'GET', body, headers = {}, signal } = options;

  const url = `${API_BASE}${path}`;

  const init: RequestInit = {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  if (!response.ok) {
    const raw = await response.text();
    const trimmed = raw.slice(0, 16_000);
    let data: unknown = null;
    if (trimmed) {
      try {
        data = JSON.parse(trimmed) as unknown;
      } catch {
        // Next.js proxy errors are often HTML/plain text, not JSON.
      }
    }
    const head = trimmed.slice(0, 4000);
    const proxyUnreachable =
      /ECONNREFUSED|Failed to proxy|AggregateError|EHOSTUNREACH|ENOTFOUND/i.test(head);
    if (
      proxyUnreachable &&
      (typeof data !== 'object' || data === null || !('detail' in (data as object)))
    ) {
      data = {
        detail:
          'Cannot reach the backend API on port 8000. From the repository root run npm run dev:full (starts Next + FastAPI), or in apps/api run: uv run uvicorn app.main:app --reload --port 8000',
      };
    }
    throw new ApiError(response.status, response.statusText, data);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', signal }),

  post: <T, B = unknown>(path: string, body: B, signal?: AbortSignal) =>
    request<T, B>(path, { method: 'POST', body, signal }),

  put: <T, B = unknown>(path: string, body: B, signal?: AbortSignal) =>
    request<T, B>(path, { method: 'PUT', body, signal }),

  patch: <T, B = unknown>(path: string, body: B, signal?: AbortSignal) =>
    request<T, B>(path, { method: 'PATCH', body, signal }),

  delete: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'DELETE', signal }),
};

export { ApiError };
