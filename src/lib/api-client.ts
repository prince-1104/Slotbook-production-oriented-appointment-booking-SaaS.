export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export interface ApiSuccessPayload<T> {
  data: T;
  requestId: string;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly requestId?: string;
  public readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

export interface HostProfileDto {
  id: string;
  email: string;
  name: string;
  slug: string;
  timezone: string;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const { idempotencyKey, headers, ...rest } = init;
  const mergedHeaders = new Headers(headers);
  mergedHeaders.set('Content-Type', 'application/json');
  if (idempotencyKey) {
    mergedHeaders.set('Idempotency-Key', idempotencyKey);
  }

  const response = await fetch(path, {
    ...rest,
    credentials: 'same-origin',
    headers: mergedHeaders,
  });

  const payload = (await response.json().catch(() => null)) as
    ApiSuccessPayload<T> | ApiErrorPayload | null;

  if (!response.ok) {
    if (payload && 'error' in payload) {
      throw new ApiClientError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.requestId,
        payload.error.details,
      );
    }
    throw new ApiClientError(
      response.status,
      'HTTP_ERROR',
      `Request failed with status ${response.status}`,
    );
  }

  if (!payload || !('data' in payload)) {
    throw new ApiClientError(response.status, 'INVALID_RESPONSE', 'Unexpected server response');
  }

  return payload.data;
}

export const apiClient = {
  auth: {
    login(body: { email: string; password: string }) {
      return apiFetch<{ host: HostProfileDto }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    logout() {
      return apiFetch<{ loggedOut: boolean }>('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    me() {
      return apiFetch<{ host: HostProfileDto }>('/api/v1/auth/me', {
        method: 'GET',
      });
    },
  },
  host: {
    getSettings() {
      return apiFetch<{ host: HostProfileDto }>('/api/v1/host/settings', {
        method: 'GET',
      });
    },
    updateSettings(body: { name: string; timezone: string }) {
      return apiFetch<{ host: HostProfileDto }>('/api/v1/host/settings', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    },
  },
};
