/**
 * Typed client for the spring-iam API.
 *
 * - Calls are same-origin under /api; the app server proxies them to IAM_URL
 *   (vite.config.ts), so spring-iam's refresh cookie stays first-party.
 * - The access token lives in memory only. On a 401 the client refreshes once
 *   (the refresh token is an httpOnly cookie) and retries.
 * - /api/auth/** and /api/authz/me/** wrap bodies as { success, message, data };
 *   the /api/v1/** admin endpoints return raw bodies. Both come back as plain data.
 * - With VITE_DEMO=true, requests are answered in the browser by ./demo instead.
 */

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let onForbidden: ((err: ApiError) => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}
export function setForbiddenHandler(fn: ((err: ApiError) => void) | null) {
  onForbidden = fn;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field errors from spring-iam's ErrorResponse.validationErrors, if any. */
  get fieldErrors(): Record<string, string> {
    const v = (this.body as { validationErrors?: unknown } | null)?.validationErrors;
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;
type Options = { method?: string; body?: unknown; query?: Query; skipAuthRetry?: boolean };

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function doFetch(path: string, opts: Options): Promise<Response> {
  const method = opts.method ?? "GET";
  if (import.meta.env.VITE_DEMO === "true") {
    // Inline env check, so normal builds drop ./demo entirely.
    const { demoFetch } = await import("./demo");
    return demoFetch(method, path, opts.query, opts.body);
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(buildUrl(path, opts.query), {
    method,
    headers,
    credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

// One refresh at a time: parallel 401s share it instead of racing the cookie rotation.
let refreshing: Promise<boolean> | null = null;

export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await doFetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) return false;
      const token = (await res.json())?.data?.accessToken;
      if (typeof token !== "string") return false;
      accessToken = token;
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

const NO_REFRESH = ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout", "/api/auth/mfa/"];

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  let res = await doFetch(path, opts);

  if (res.status === 401 && !opts.skipAuthRetry && !NO_REFRESH.some((p) => path.startsWith(p))) {
    if (await refreshAccessToken()) {
      res = await doFetch(path, opts);
    } else {
      onUnauthorized?.();
      throw new ApiError(401, "Your session has ended. Sign in again.", null);
    }
  }

  const body = await parse(res);

  if (!res.ok) {
    const m = (body as { message?: unknown } | null)?.message;
    const message =
      typeof m === "string" && m
        ? m
        : res.status >= 500
          ? "The server had a problem. Try again in a moment."
          : `Request failed (${res.status})`;
    const err = new ApiError(res.status, message, body);
    if (res.status === 403) onForbidden?.(err);
    throw err;
  }

  // Unwrap spring-iam's ApiResponse envelope. `data` is omitted when null.
  if (body && typeof body === "object" && "success" in body) {
    return (body as { data?: T }).data as T;
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>(path, { method: "POST", body, query }),
  put: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>(path, { method: "PUT", body, query }),
  del: <T>(path: string, query?: Query) => request<T>(path, { method: "DELETE", query }),
};
