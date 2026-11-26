import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoFetch } from "./demo";

const store = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const call = async (
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, unknown>,
) => {
  const res = await demoFetch(method, path, query, body);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const signIn = (email: string) => call("POST", "/api/auth/login", { email, password: "x" });

beforeEach(() => store.clear());

describe("demo IAM", () => {
  it("needs a sign-in, and rejects the password 'wrong'", async () => {
    expect((await call("GET", "/api/v1/roles")).status).toBe(401);
    expect(
      (await call("POST", "/api/auth/login", { email: "admin@example.com", password: "wrong" }))
        .status,
    ).toBe(401);
  });

  it("wraps /api/auth in the envelope and keeps /api/v1 raw, like spring-iam", async () => {
    const login = await signIn("admin@example.com");
    expect(login.body).toMatchObject({ success: true, data: { tokenType: "Bearer" } });
    const roles = await call("GET", "/api/v1/roles");
    expect(Array.isArray(roles.body)).toBe(true);
  });

  it("keeps the auditor read-only, and logs the refused change", async () => {
    await signIn("auditor@example.com");
    expect((await call("POST", "/api/v1/groups", { name: "x" })).status).toBe(403);
    const log = await call("GET", "/api/v1/audit/admin-actions", undefined, { page: 0, size: 5 });
    expect(log.body.content[0]).toMatchObject({
      method: "POST",
      path: "/api/v1/groups",
      status: 403,
    });
  });

  it("explains a deny rule before anything else", async () => {
    await signIn("admin@example.com");
    const users = await call("GET", "/api/v1/identities", undefined, { query: "ram" });
    const ram = users.body[0];
    const scopes = await call("GET", "/api/v1/scopes");
    const ktm = scopes.body.find((s: { code: string }) => s.code === "ktm");
    const r = await call("POST", "/api/v1/authorize/explain", {
      subject: ram.id,
      permission: "orders.order.refund",
      resource: { scopeId: ktm.id },
    });
    expect(r.body.allowed).toBe(false);
    expect(r.body.steps[0]).toMatchObject({ name: "deny_rules", outcome: "DENY" });
  });
});
