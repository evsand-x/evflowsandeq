import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { ambiguousCompanyIds, loginCompanies, loginErrorMessage, validateLogin } from "./login";

describe("login feedback and company selection", () => {
  it("identifies ambiguous names without blocking distinguishable companies", () => {
    expect(
      ambiguousCompanyIds([
        { id: "a", name: " Company A " },
        { id: "b", name: "company a" },
        { id: "c", name: "Company B" },
      ]),
    ).toEqual(["a", "b"]);
    expect(
      ambiguousCompanyIds([
        { id: "a", name: "Company A" },
        { id: "b", name: "Company B" },
      ]),
    ).toEqual([]);
  });
  const choices = {
    code: "COMPANY_SELECTION_REQUIRED",
    companies: [
      { id: "00000000-0000-4000-8000-000000000001", name: "DATA UJI A" },
      { id: "00000000-0000-4000-8000-000000000002", name: "DATA UJI B" },
    ],
  };

  it("only accepts a validated company-selection challenge", () => {
    expect(loginCompanies(new ApiError(409, "", choices))).toEqual(choices.companies);
    expect(loginCompanies(new ApiError(401, "", choices))).toBeNull();
    expect(
      loginCompanies(new ApiError(409, "", { ...choices, companies: [{ id: "bad", name: "A" }] })),
    ).toBeNull();
    expect(
      loginCompanies(new ApiError(409, "", { ...choices, code: "OTHER_CONFLICT" })),
    ).toBeNull();
  });

  it("keeps technical errors and account existence out of login feedback", () => {
    const unknown = loginErrorMessage(new ApiError(401, "Unknown email"));
    expect(loginErrorMessage(new ApiError(401, "Inactive membership"))).toBe(unknown);
    expect(loginErrorMessage(new ApiError(500, "SQL password_hash failure"))).not.toMatch(
      /SQL|password_hash/,
    );
    expect(loginErrorMessage(new ApiError(429, ""))).toContain("Tunggu");
    expect(loginErrorMessage(new ApiError(503, ""))).toContain("sementara tidak tersedia");
    expect(loginErrorMessage(new TypeError("Failed to fetch"))).toContain("jaringan");
  });

  it("validates against the public credential constraints without changing the password", () => {
    expect(validateLogin("", "")).toEqual({
      email: "Masukkan email Anda.",
      password: "Masukkan kata sandi Anda.",
    });
    expect(validateLogin("bad", "short")).toHaveProperty("email");
    expect(validateLogin("test@example.com", "x".repeat(201))).toHaveProperty("password");
    expect(validateLogin("test@example.com", " padded password ")).toEqual({});
  });
});
