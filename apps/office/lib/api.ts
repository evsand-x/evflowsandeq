const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

let csrfToken: string | undefined;
let refreshInFlight: Promise<Response> | undefined;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly problem?: unknown,
  ) {
    super(message);
  }
}

async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${apiBaseUrl}/auth/csrf`, {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await parseResponse<{ data: { csrf_token: string } }>(response);
  csrfToken = payload.data.csrf_token;
  return csrfToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { version?: number } = {},
): Promise<T> {
  const response = await performRequest(path, options);
  if (
    response.status === 401 &&
    !["/auth/login", "/auth/refresh", "/auth/logout", "/auth/csrf"].includes(path)
  ) {
    const token = await ensureCsrf();
    refreshInFlight ??= fetch(`${apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "X-CSRF-Token": token },
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    }).finally(() => {
      refreshInFlight = undefined;
    });
    const refresh = await refreshInFlight;
    if (refresh.ok) return parseResponse<T>(await performRequest(path, options));
    if (refresh.status !== 401) return parseResponse<T>(refresh);
  }
  return parseResponse<T>(response);
}

async function performRequest(path: string, options: RequestInit & { version?: number }) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (options.version) headers.set("If-Match", `"${options.version}"`);
  if (options.method && !["GET", "HEAD"].includes(options.method)) {
    headers.set("X-CSRF-Token", await ensureCsrf());
  }
  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store",
    signal: options.signal ?? (path.startsWith("/auth/") ? AbortSignal.timeout(20_000) : null),
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const problem = (await response.json().catch(() => undefined)) as
      | { detail?: string; message?: string }
      | undefined;
    const translated = translateProblem(problem);
    throw new ApiError(
      response.status,
      translated.message || `Request gagal (${response.status}).`,
      translated.settings_href ? { ...problem, settings_href: translated.settings_href } : problem,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function resetCsrf() {
  csrfToken = undefined;
}

/** Turns configuration error codes into guidance that points at the Setting page to fix them. */
export function translateProblem(problem: { detail?: string; message?: string } | undefined): {
  message: string;
  settings_href?: string;
} {
  const detail = problem?.detail ?? problem?.message ?? "";
  if (/^NUMBERING_RULE_REQUIRED_OR_CONFLICTING:\w+$/.test(detail))
    return {
      message:
        "Penomoran dokumen belum diatur. Buka Setting › Penomoran Dokumen untuk mengaktifkannya.",
      settings_href: "/setting/numbering",
    };
  return { message: detail };
}
