import { describe, expect, it } from "vitest";

import { humanize, timeAgo } from "./format";

describe("humanize", () => {
  it("turns enum names into sentence case and keeps acronyms", () => {
    expect(humanize("LOGIN_FAILED")).toBe("Login failed");
    expect(humanize("MFA_ENABLED")).toBe("MFA enabled");
  });
});

describe("timeAgo", () => {
  it("speaks relative time and handles bad input", () => {
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe("3 hours ago");
    expect(timeAgo(new Date(Date.now() + 2 * 86_400_000 + 60_000).toISOString())).toBe("in 2 days");
    expect(timeAgo(null)).toBe("—");
    expect(timeAgo("not a date")).toBe("—");
  });
});
