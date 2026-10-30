"use client";

import type { AuthPrincipal, LoginCompanyOption } from "@evflow/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest, resetCsrf } from "../../lib/api";
import {
  ambiguousCompanyIds,
  loginCompanies,
  loginErrorMessage,
  validateLogin,
  type LoginFieldErrors,
} from "../../lib/login";
import { notifyLogin, useSession } from "../session-provider";

export default function LoginPage() {
  const router = useRouter();
  const { state, reload } = useSession();
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState<"credentials" | "company" | "verify">("credentials");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [companies, setCompanies] = useState<LoginCompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [email, setEmail] = useState("");
  const ambiguousIds = ambiguousCompanyIds(companies);
  const credentials = useRef<{ email: string; password: string } | null>(null);
  const inFlight = useRef(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const companyTrigger = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setSessionEnded(new URLSearchParams(window.location.search).get("session") === "ended");
    return () => {
      credentials.current = null;
    };
  }, []);

  useEffect(() => {
    if (state === "authenticated" && !pending) {
      credentials.current = null;
      router.replace("/");
    }
  }, [pending, router, state]);

  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error, fieldErrors]);

  useEffect(() => {
    if (stage === "company" && !pending && !error) companyTrigger.current?.focus();
  }, [stage, pending, error]);

  function startOver() {
    credentials.current = null;
    form.current?.reset();
    setCompanies([]);
    setCompanyId("");
    setError(null);
    setFieldErrors({});
    setShowPassword(false);
    setCapsLock(false);
    setStage("credentials");
    requestAnimationFrame(() => document.getElementById("email")?.focus());
  }

  async function verifySession() {
    if (await reload()) {
      notifyLogin();
      router.replace("/");
    } else {
      setError("Akses belum dapat diverifikasi. Periksa sesi kembali atau masuk ulang.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || state === "loading" || state === "authenticated") return;
    setError(null);
    setFieldErrors({});
    let input = credentials.current;
    if (stage === "credentials") {
      const data = new FormData(event.currentTarget);
      input = {
        email: String(data.get("email") ?? "").trim(),
        password: String(data.get("password") ?? ""),
      };
      const invalid = validateLogin(input.email, input.password);
      if (Object.keys(invalid).length) {
        setFieldErrors(invalid);
        setError("Periksa isian berikut.");
        return;
      }
      setEmail(input.email);
    }
    if (
      stage === "company" &&
      (!companies.some((company) => company.id === companyId) || ambiguousIds.includes(companyId))
    ) {
      setFieldErrors({ company: "Pilih perusahaan untuk melanjutkan." });
      setError("Pilih perusahaan Anda.");
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      if (stage === "verify") {
        await verifySession();
        return;
      }
      if (!input) {
        startOver();
        return;
      }
      try {
        await apiRequest<{ data: AuthPrincipal }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            ...input,
            ...(stage === "company" ? { company_id: companyId } : {}),
          }),
        });
      } catch (failure) {
        const choices = loginCompanies(failure);
        if (choices) {
          credentials.current = input;
          form.current?.reset();
          setCompanies(choices);
          setCompanyId("");
          setStage("company");
          setShowPassword(false);
          setSessionEnded(false);
          return;
        }
        resetCsrf();
        setError(loginErrorMessage(failure));
        return;
      }
      credentials.current = null;
      form.current?.reset();
      setCompanies([]);
      setStage("verify");
      setSessionEnded(false);
      await verifySession();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const busy = pending || state === "loading" || state === "authenticated";
  const companySelectionBlocked =
    stage === "company" && companies.length > 0 && ambiguousIds.length === companies.length;
  const buttonLabel = busy
    ? stage === "verify" || state === "authenticated"
      ? "Menyiapkan akses…"
      : pending
        ? "Memeriksa akun…"
        : "Memeriksa sesi…"
    : stage === "company"
      ? "Lanjutkan"
      : stage === "verify"
        ? "Periksa sesi kembali"
        : "Masuk";

  return (
    <main className="login-page bg-card grid min-h-dvh lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)]">
      <aside
        className="bg-primary text-primary-foreground relative hidden overflow-hidden px-12 py-12 lg:flex lg:flex-col xl:px-14"
        aria-label="evflow"
      >
        <div className="text-3xl font-semibold tracking-tight">evflow</div>
        <div className="my-auto py-16">
          <p className="mb-7 text-[13px] font-semibold tracking-wide text-emerald-100">
            PT SANDEQ SARANA MEDIKA
          </p>
          <p className="max-w-md text-5xl font-medium leading-[1.12] tracking-[-0.08em] xl:text-[48px]">
            "Tania tau passobal moaq mappelinoi,
            <br />
            lembong ditia mepadzottong lawuang“
            <br />
            -Adagium Pelaut Mandar-
          </p>
          <div className="mt-7 flex items-center gap-3 border-t border-white/20 pt-4 text-[13px]">
            <span>Inisiasi</span>
            <ArrowRight className="size-4 text-emerald-200" aria-hidden="true" />
            <span>Kreasi</span>
            <ArrowRight className="size-4 text-emerald-200" aria-hidden="true" />
            <span>Inovasi</span>
          </div>
        </div>
        <p className="text-xs text-emerald-100">evflow Version 1.0.0</p>
      </aside>

      <section
        className="flex min-w-0 flex-col px-6 py-8 sm:px-12 lg:px-16 lg:py-12"
        aria-labelledby="login-title"
      >
        <header className="flex items-center justify-between gap-4">
          <span className="text-primary text-2xl font-semibold tracking-tight lg:invisible">
            evflow
          </span>
          <span className="text-muted-foreground text-xs">evflow version 1.0.0</span>
        </header>
        <div className="mx-auto my-auto w-full max-w-[400px] py-12 sm:py-16">
          <div className="mb-8">
            <h1 id="login-title" className="text-3xl font-semibold tracking-tight">
              {stage === "company"
                ? "Pilih perusahaan"
                : stage === "verify"
                  ? "Menyiapkan akses"
                  : "Selamat datang kembali"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {stage === "company"
                ? "Lanjutkan ke perusahaan yang ingin Anda buka."
                : stage === "verify"
                  ? "Memuat profil dan hak akses Anda."
                  : "Masuk ke akun evflow Anda."}
            </p>
          </div>

          <form
            ref={form}
            onSubmit={submit}
            noValidate
            className="flex flex-col gap-6"
            aria-busy={busy}
          >
            {sessionEnded && (
              <Alert role="status" className="login-status login-status-info">
                <Info aria-hidden="true" />
                <AlertDescription>Sesi berakhir. Silakan masuk kembali.</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert
                ref={errorSummary}
                tabIndex={-1}
                className="login-status login-status-error focus-visible:outline-ring focus-visible:outline-2"
                aria-labelledby="login-error-title"
              >
                <CircleAlert aria-hidden="true" />
                <AlertTitle id="login-error-title" className="sr-only">
                  Belum dapat melanjutkan
                </AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  {Object.entries(fieldErrors).map(([field, message]) => (
                    <a
                      className="inline-flex min-h-11 items-center underline underline-offset-4"
                      key={field}
                      href={`#${field}`}
                    >
                      {message}
                    </a>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {stage === "verify" && (
              <div className="login-loading-panel" role="status" aria-live="polite">
                <LoaderCircle
                  aria-hidden="true"
                  className="text-primary size-7 animate-spin motion-reduce:animate-none"
                />
                <span className="text-base font-medium">Menyiapkan akses…</span>
              </div>
            )}

            {stage === "credentials" && (
              <FieldGroup className="gap-5">
                <Field data-invalid={Boolean(fieldErrors.email)}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={email}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    disabled={busy}
                    className="h-12"
                    placeholder="Email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  />
                  {fieldErrors.email && (
                    <FieldError id="email-error">{fieldErrors.email}</FieldError>
                  )}
                </Field>
                <Field data-invalid={Boolean(fieldErrors.password)}>
                  <FieldLabel htmlFor="password">Kata sandi</FieldLabel>
                  <InputGroup className="h-12">
                    <InputGroupInput
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      disabled={busy}
                      placeholder="Masukkan kata sandi"
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={
                        [fieldErrors.password ? "password-error" : "", capsLock ? "caps-lock" : ""]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                      onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                      onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                      onBlur={() => setCapsLock(false)}
                    />
                    <InputGroupAddon align="inline-end" className="pr-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11"
                        disabled={busy}
                        aria-label={
                          showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                        }
                        aria-pressed={showPassword}
                        aria-controls="password"
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                  {capsLock && (
                    <p id="caps-lock" className="text-muted-foreground text-sm" role="status">
                      Caps Lock aktif.
                    </p>
                  )}
                  {fieldErrors.password && (
                    <FieldError id="password-error">{fieldErrors.password}</FieldError>
                  )}
                </Field>
              </FieldGroup>
            )}

            {stage === "company" && (
              <FieldGroup className="gap-5">
                <p className="text-muted-foreground break-words text-sm">{email}</p>
                {ambiguousIds.length > 0 && (
                  <Alert role="status">
                    <Info aria-hidden="true" />
                    <AlertDescription id="company-ambiguity">
                      Ada perusahaan bernama sama. Minta administrator membedakan nama perusahaan
                      sebelum memilihnya.
                    </AlertDescription>
                  </Alert>
                )}
                <Field data-invalid={Boolean(fieldErrors.company)}>
                  <FieldLabel htmlFor="company">Perusahaan</FieldLabel>
                  <Select value={companyId} onValueChange={setCompanyId} disabled={busy}>
                    <SelectTrigger
                      ref={companyTrigger}
                      id="company"
                      className="min-h-12 w-full"
                      aria-invalid={Boolean(fieldErrors.company)}
                      aria-describedby={
                        [
                          fieldErrors.company ? "company-error" : "",
                          ambiguousIds.length ? "company-ambiguity" : "",
                        ]
                          .filter(Boolean)
                          .join(" ") || undefined
                      }
                    >
                      <SelectValue placeholder="Pilih perusahaan" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {companies.map((company) => (
                          <SelectItem
                            key={company.id}
                            value={company.id}
                            disabled={ambiguousIds.includes(company.id)}
                            className="min-h-11 whitespace-normal break-words"
                          >
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldErrors.company && (
                    <FieldError id="company-error">{fieldErrors.company}</FieldError>
                  )}
                </Field>
              </FieldGroup>
            )}

            {stage !== "verify" || Boolean(error) ? (
              <Button
                className="h-12 w-full"
                disabled={busy || companySelectionBlocked}
                aria-describedby={companySelectionBlocked ? "company-ambiguity" : undefined}
                type="submit"
              >
                {busy ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                    data-icon="inline-start"
                  />
                ) : null}
                {buttonLabel}
                {!busy && <ArrowRight aria-hidden="true" data-icon="inline-end" />}
              </Button>
            ) : null}
            <span className="sr-only" role="status" aria-live="polite">
              {busy ? buttonLabel : ""}
            </span>
            {stage !== "credentials" && (
              <Button
                className="min-h-11"
                variant="ghost"
                type="button"
                onClick={startOver}
                disabled={busy}
              >
                <ArrowLeft aria-hidden="true" data-icon="inline-start" />
                {stage === "company" ? "Gunakan akun lain" : "Masuk ulang"}
              </Button>
            )}
          </form>

          <div className="mt-7">
            <details className="text-muted-foreground text-sm">
              <summary className="focus-visible:outline-ring flex min-h-11 cursor-pointer items-center gap-2 rounded-sm focus-visible:outline-2">
                <span>Kendala akses?</span>
                <span className="text-primary font-semibold">Hubungi admin</span>
              </summary>
              <p className="pb-3 leading-6">
                Hubungi administrator perusahaan untuk bantuan akun. Pemulihan kata sandi belum
                tersedia.
              </p>
            </details>
          </div>
        </div>
        <footer className="text-muted-foreground mx-auto flex w-full max-w-[400px] items-center justify-between gap-4 text-xs">
          <span>© 2026 evflow</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Akses internal perusahaan
          </span>
        </footer>
      </section>
    </main>
  );
}
