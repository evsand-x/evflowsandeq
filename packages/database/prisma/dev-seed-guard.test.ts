import { describe, expect, it } from "vitest";
import { assertDevelopmentSeed } from "./dev-seed-guard";
const local = {
  NODE_ENV: "development",
  EVFLOW_ALLOW_DEV_SEED: "LOCAL_FICTITIOUS_ONLY",
  DATABASE_URL: "postgresql://dev:dev@127.0.0.1:5432/evflow",
  S3_ENDPOINT: "http://localhost:9000",
};
describe("development seed boundary", () => {
  it("allows the explicitly opted-in local development target", () =>
    expect(() => assertDevelopmentSeed(local)).not.toThrow());
  it.each(["production", "test", ""])("rejects environment %s", (NODE_ENV) =>
    expect(() => assertDevelopmentSeed({ ...local, NODE_ENV })).toThrow(),
  );
  it("requires an explicit opt-in", () =>
    expect(() => assertDevelopmentSeed({ ...local, EVFLOW_ALLOW_DEV_SEED: "" })).toThrow());
  it.each([
    "postgresql://dev:dev@db.example.com/evflow",
    "postgresql://dev:dev@127.0.0.1/production",
  ])("rejects target %s", (DATABASE_URL) =>
    expect(() => assertDevelopmentSeed({ ...local, DATABASE_URL })).toThrow(),
  );
  it("rejects remote storage", () =>
    expect(() =>
      assertDevelopmentSeed({ ...local, S3_ENDPOINT: "https://storage.example.com" }),
    ).toThrow());
});
