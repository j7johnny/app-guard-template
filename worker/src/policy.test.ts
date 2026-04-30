import { describe, expect, it } from "vitest";
import { compareVersions, evaluatePolicy } from "./policy";

describe("policy evaluation", () => {
  it("allows by default", () => {
    const result = evaluatePolicy(null, { app_id: "x", version: "1.0.0" });
    expect(result.status).toBe("allow");
    expect(result.disable).toBe(false);
  });

  it("warns old versions", () => {
    const result = evaluatePolicy({
      schema_version: 1,
      rules: [{
        id: "old",
        priority: 1,
        match: { version_lt: "1.2.0" },
        action: { status: "warn", message: "update" },
      }],
    }, { app_id: "x", version: "1.1.9" });
    expect(result.status).toBe("warn");
    expect(result.message).toBe("update");
  });

  it("disables a leaked build", () => {
    const result = evaluatePolicy({
      schema_version: 1,
      rules: [{
        id: "leak",
        priority: 100,
        match: { build_id: "bad" },
        action: { status: "disabled", message: "blocked" },
      }],
    }, { app_id: "x", version: "2.0.0", build_id: "bad" });
    expect(result.disable).toBe(true);
  });

  it("compares versions numerically", () => {
    expect(compareVersions("1.10.0", "1.2.9")).toBe(1);
    expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
  });
});
