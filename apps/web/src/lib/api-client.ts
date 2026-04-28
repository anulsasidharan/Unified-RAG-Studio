const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    const data = await response.json().catch(() => null);
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
