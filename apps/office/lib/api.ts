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

/** The Setting page that fixes this error, when the API problem carries one. */
export function settingsHrefOf(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const href = (error.problem as { settings_href?: unknown } | undefined)?.settings_href;
  return typeof href === "string" && href.startsWith("/setting/") ? href : undefined;
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
  if (detail === "NUMBERING_DIGITS_TOO_SHORT")
    return {
      message:
        "Jumlah digit urutan lebih pendek dari nomor yang sedang berjalan. Tambah jumlah digit di Setting › Penomoran Dokumen.",
      settings_href: "/setting/numbering",
    };
  if (detail === "NUMBERING_CURRENT_BELOW_USED")
    return {
      message:
        "Nomor saat ini tidak boleh lebih kecil dari nomor yang sudah terpakai. Muat ulang Setting › Penomoran Dokumen lalu coba lagi.",
      settings_href: "/setting/numbering",
    };
  if (detail === "DOCUMENT_NUMBER_EXHAUSTED")
    return {
      message:
        "Nomor dokumen sudah melewati jumlah digit yang diatur. Tambah jumlah digit di Setting › Penomoran Dokumen.",
      settings_href: "/setting/numbering",
    };
  if (detail === "DEFAULT_SALES_TAX_REQUIRED")
    return {
      message:
        "Pajak penjualan bawaan belum diatur. Tandai satu pajak sebagai bawaan penjualan di Setting › Pajak.",
      settings_href: "/setting/tax",
    };
  if (detail === "POSTING_PROFILE_REQUIRED_OR_CONFLICTING")
    return {
      message:
        "Pemetaan akun belum lengkap atau bentrok. Periksa Setting › Pemetaan Akun, pastikan setiap jenis jurnal memiliki satu pemetaan aktif.",
      settings_href: "/setting/account-mapping",
    };
  if (detail === "IDEMPOTENCY_PAYLOAD_MISMATCH")
    return {
      message:
        "Isi percobaan ulang berbeda dari transaksi sebelumnya. Muat ulang data dan periksa status transaksi.",
    };
  if (detail === "PAYMENT_POLICY_REQUIRED")
    return {
      message:
        "Pelanggan belum punya termin bawaan dan daftar termin tidak memiliki termin COD. Tambahkan termin COD di Setting › Termin & Kredit.",
      settings_href: "/setting/terms",
    };
  if (detail === "PAYMENT_TERM_INVALID")
    return {
      message:
        "Termin bawaan pelanggan tidak ada lagi di daftar termin. Pilih termin lain pada data pelanggan atau periksa Setting › Termin & Kredit.",
      settings_href: "/setting/terms",
    };
  const inUse = /^PAYMENT_TERM_IN_USE:(\d+)$/.exec(detail);
  if (inUse)
    return {
      message: `Termin tidak dapat dihapus atau diganti kodenya karena masih menjadi termin bawaan ${inUse[1]} pelanggan. Pindahkan pelanggan tersebut ke termin lain di Master Data › Pelanggan, lalu ulangi.`,
      settings_href: "/master-data/customers",
    };
  const taxMessages: Record<string, string> = {
    TAX_DEFAULT_INVALID:
      "Pajak bawaan harus PPN yang aktif, ditambahkan ke transaksi, dan berlaku untuk penggunaan tersebut.",
    LINE_TAX_NOT_ALLOWED:
      "Pajak tidak dapat dipilih per baris. Setiap baris memakai pajak penjualan bawaan dari Setting › Pajak.",
    FREIGHT_TAX_RULE_NOT_ALLOWED:
      "Aturan pajak ongkir tidak dapat dipilih. Ongkir kena pajak memakai pajak penjualan bawaan.",
    TAX_DEFAULT_REQUIRED_ACTIVE:
      "Pajak bawaan tidak dapat dinonaktifkan. Jadikan pajak lain sebagai bawaan terlebih dahulu.",
    TAX_VERSION_CONFLICT:
      "Pajak ini baru saja diubah orang lain. Muat ulang lalu ulangi perubahan.",
    TAX_NAME_EXISTS: "Nama pajak sudah dipakai. Gunakan nama lain.",
    TAX_ACCOUNT_INVALID: "Akun pajak harus akun rincian yang aktif.",
  };
  if (taxMessages[detail]) return { message: taxMessages[detail] };
  return { message: detail };
}
