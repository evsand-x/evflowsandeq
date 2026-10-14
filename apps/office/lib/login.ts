import {
  companySelectionRequiredSchema,
  loginRequestSchema,
  type LoginCompanyOption,
} from "@evflow/contracts";
import { ApiError } from "./api";

export type LoginFieldErrors = { email?: string; password?: string; company?: string };

export function ambiguousCompanyIds(companies: LoginCompanyOption[]): string[] {
  const normalizedName = (name: string) =>
    name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
  const counts = new Map<string, number>();
  for (const company of companies) {
    const name = normalizedName(company.name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return companies
    .filter((company) => (counts.get(normalizedName(company.name)) ?? 0) > 1)
    .map((company) => company.id);
}

export function validateLogin(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  if (!loginRequestSchema.shape.email.safeParse(email).success) {
    errors.email = email ? "Masukkan alamat email yang valid." : "Masukkan email Anda.";
  }
  if (!loginRequestSchema.shape.password.safeParse(password).success) {
    errors.password = password
      ? "Kata sandi harus berisi 8–200 karakter."
      : "Masukkan kata sandi Anda.";
  }
  return errors;
}

export function loginCompanies(failure: unknown) {
  if (!(failure instanceof ApiError) || failure.status !== 409) return null;
  const selection = companySelectionRequiredSchema.safeParse(failure.problem);
  return selection.success ? selection.data.companies : null;
}

export function loginErrorMessage(failure: unknown): string {
  if (failure instanceof ApiError) {
    if (failure.status === 401) return "Email atau kata sandi tidak sesuai. Periksa dan coba lagi.";
    if (failure.status === 429)
      return "Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.";
    if (failure.status === 409) return "Pilihan perusahaan belum dapat dimuat. Coba masuk kembali.";
    if (failure.status === 400 || failure.status === 422)
      return "Periksa email dan kata sandi Anda, lalu coba lagi.";
    if (failure.status === 403)
      return "Permintaan masuk tidak diizinkan. Muat ulang halaman lalu coba lagi.";
    return "Layanan masuk sementara tidak tersedia. Coba lagi dalam beberapa saat.";
  }
  return "Koneksi belum berhasil. Periksa jaringan Anda, lalu coba lagi.";
}
