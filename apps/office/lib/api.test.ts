import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, resetCsrf } from "./api";

describe("authentication API transport", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    resetCsrf();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("retains the structured company challenge for the login UI", async () => {
    const problem = {
      code: "COMPANY_SELECTION_REQUIRED",
      companies: [],
      detail: "Pilih perusahaan.",
    };
    fetchMock.mockResolvedValueOnce(Response.json({ data: { csrf_token: "test" } }));
    fetchMock.mockResolvedValueOnce(Response.json(problem, { status: 409 }));
    await expect(apiRequest("/auth/login", { method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 409,
      problem,
    });
    expect(fetchMock.mock.calls[1]?.[1]?.credentials).toBe("include");
    expect(fetchMock.mock.calls[1]?.[1]?.cache).toBe("no-store");
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("X-CSRF-Token")).toBe("test");
  });

  it("never retries or refreshes rejected credentials", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: { csrf_token: "test" } }));
    fetchMock.mockResolvedValueOnce(
      Response.json({ detail: "Invalid credentials" }, { status: 401 }),
    );
    await expect(apiRequest("/auth/login", { method: "POST", body: "{}" })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([429, 503])(
    "preserves refresh failure %i instead of reporting an ended session",
    async (status) => {
      fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }));
      fetchMock.mockResolvedValueOnce(Response.json({ data: { csrf_token: "test" } }));
      fetchMock.mockResolvedValueOnce(
        Response.json({ detail: "Temporarily unavailable" }, { status }),
      );
      await expect(apiRequest("/auth/me")).rejects.toMatchObject({ status });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  it("preserves a failed CSRF bootstrap status", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ detail: "Unavailable" }, { status: 503 }));
    await expect(apiRequest("/auth/login", { method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
