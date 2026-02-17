/**
 * API Client
 * Centralized HTTP client with error handling and response parsing
 */

import { API_ENDPOINTS, createFetchOptions } from './config';

export interface ApiError {
  message: string;
  status: number;
  detail?: string;
}

export class ApiClientError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.detail = formatApiDetail(detail);
  }
}

function formatApiDetail(detail: unknown): string | undefined {
  if (detail == null) return undefined;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc = 'loc' in item && Array.isArray(item.loc) ? item.loc.join('.') : '';
          return loc ? `${loc}: ${String(item.msg)}` : String(item.msg);
        }
        return JSON.stringify(item);
      })
      .join('; ');
  }
  if (typeof detail === 'object') return JSON.stringify(detail);
  return String(detail);
}

function buildFetchOptions(options: RequestInit = {}): RequestInit {
  const merged = createFetchOptions(options);
  const isFormData =
    typeof FormData !== 'undefined' && merged.body instanceof FormData;

  if (isFormData && merged.headers) {
    const headers = new Headers(merged.headers as HeadersInit);
    headers.delete('Content-Type');
    merged.headers = headers;
  }

  return merged;
}

const DEFAULT_TIMEOUT_MS = 90_000;
export const CHAT_TIMEOUT_MS = 180_000;

/**
 * Generic API request handler
 */
async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, buildFetchOptions({
      ...options,
      signal: controller.signal,
    }));

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await response.text();
      if (!response.ok) {
        const brief = text.includes('<html')
          ? `Server unavailable (${response.status}). Backend wake-up ho raha ho sakta hai — 30s baad retry karein.`
          : text.slice(0, 200) || `Request failed with status ${response.status}`;
        throw new ApiClientError(brief, response.status);
      }
      return text as unknown as T;
    }

    const data = await response.json();

    if (!response.ok) {
      const detailText = formatApiDetail(data.detail);
      throw new ApiClientError(
        detailText || data.message || 'Request failed',
        response.status,
        data.detail
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiClientError(
        'Server is waking up — Render free tier can take up to 60 seconds. Please try again.',
        0
      );
    }

    throw new ApiClientError(
      error instanceof Error ? error.message : 'Network error occurred',
      0
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/** Wake master agent before chat (Render free tier cold start). */
export function warmApiService(): void {
  const url = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  fetch(`${url}/`, { method: 'GET' }).catch(() => undefined);
}

/** Wake API before login (Render free tier cold start). */
export function warmCrmService(): void {
  warmApiService();
}

/**
 * GET request
 */
export async function get<T>(url: string, options?: RequestInit): Promise<T> {
  return apiRequest<T>(url, { ...options, method: 'GET' });
}

/**
 * POST request
 */
export async function post<T>(
  url: string,
  body?: unknown,
  options?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }, timeoutMs);
}

/**
 * POST request with FormData (for file uploads)
 */
export async function postFormData<T>(
  url: string,
  formData: FormData,
  options?: RequestInit
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'POST',
    body: formData,
  });
}

/**
 * PUT request
 */
export async function put<T>(
  url: string,
  body?: unknown,
  options?: RequestInit
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request
 */
export async function patch<T>(
  url: string,
  body?: unknown,
  options?: RequestInit
): Promise<T> {
  return apiRequest<T>(url, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request
 */
export async function del<T>(url: string, options?: RequestInit): Promise<T> {
  return apiRequest<T>(url, { ...options, method: 'DELETE' });
}

