import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, setAccessToken } from "./client";

const json = (status: number, body: unknown) => Response.json(body, { status });

function stubFetch(...replies: Response[]) {
  const fn = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => replies.shift()!);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe("request", () => {
  it("unwraps spring-iam's { success, message, data } envelope", async () => {
    stubFetch(json(200, { success: true, message: "ok", data: ["a", "b"] }));
    await expect(api.get("/api/authz/me/scopes")).resolves.toEqual(["a", "b"]);
  });

  it("passes raw /api/v1 bodies through untouched", async () => {
    stubFetch(json(200, [{ id: "r1", name: "Admin" }]));
    await expect(api.get("/api/v1/roles")).resolves.toEqual([{ id: "r1", name: "Admin" }]);
  });

  it("returns undefined when the envelope omits null data", async () => {
    stubFetch(json(200, { success: true, message: "Logged out" }));
    await expect(api.post("/api/auth/logout")).resolves.toBeUndefined();
  });

  it("uses the server's message and keeps validation errors", async () => {
    stubFetch(
      json(400, {
        status: 400,
        message: "Validation failed",
        validationErrors: { confirmPassword: "must not be blank" },
      }),
    );
    const err = (await api.post("/api/auth/change-password", {}).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Validation failed");
    expect(err.fieldErrors).toEqual({ confirmPassword: "must not be blank" });
  });

  it("sends the access token and builds query strings without empty values", async () => {
    const fetch = stubFetch(json(200, []));
    setAccessToken("t1");
    await api.get("/api/v1/identities", { query: "ana", status: "", page: 0 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/v1/identities?query=ana&page=0");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer t1");
  });
});

describe("refresh on 401", () => {
  it("refreshes once and retries with the new token", async () => {
    const fetch = stubFetch(
      json(401, { message: "expired" }),
      json(200, { success: true, data: { accessToken: "new" } }),
      json(200, [1]),
    );
    await expect(api.get("/api/v1/roles")).resolves.toEqual([1]);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      "/api/v1/roles",
      "/api/auth/refresh",
      "/api/v1/roles",
    ]);
    expect((fetch.mock.calls[2][1]?.headers as Record<string, string>).Authorization).toBe(
      "Bearer new",
    );
  });

  it("does not try to refresh a failed login", async () => {
    const fetch = stubFetch(json(401, { message: "Invalid email or password" }));
    await expect(api.post("/api/auth/login", {})).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes /api/auth/sessions, which the old client skipped", async () => {
    const fetch = stubFetch(
      json(401, {}),
      json(200, { success: true, data: { accessToken: "x" } }),
      json(200, { success: true, data: [] }),
    );
    await expect(api.get("/api/auth/sessions")).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
