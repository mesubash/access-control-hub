import { describe, expect, it } from "vitest";

import { describeAction, describeResult } from "./describeAction";

describe("describeAction", () => {
  it("names known admin calls in plain words", () => {
    expect(describeAction("PUT", "/api/v1/roles/9f1/permissions")).toBe(
      "Changed a role's permissions",
    );
    expect(describeAction("DELETE", "/api/v1/assignments/abc?reason=left")).toBe(
      "Took a role away",
    );
    expect(describeAction("DELETE", "/api/v1/groups/g1/members/u1")).toBe(
      "Removed someone from a group",
    );
  });

  it("falls back to the raw request", () => {
    expect(describeAction("PATCH", "/api/v1/whatever")).toBe("PATCH /api/v1/whatever");
  });

  it("labels results", () => {
    expect(describeResult(201)).toEqual({ label: "Done", ok: true });
    expect(describeResult(403)).toEqual({ label: "Refused", ok: false });
    expect(describeResult(500)).toEqual({ label: "Failed (500)", ok: false });
  });
});
