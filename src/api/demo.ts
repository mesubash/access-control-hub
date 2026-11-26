/**
 * Demo mode: an in-browser stand-in for spring-iam, so every page can be tried
 * without a backend. Turned on with VITE_DEMO=true at build time. Data lives in
 * memory for the tab (the signed-in user in sessionStorage, so a reload keeps
 * you signed in); nothing is sent anywhere. Not a security boundary.
 *
 *   admin@example.com    full access
 *   auditor@example.com  read-only: every change returns 403
 * Any password works except "wrong".
 *
 * Responses copy spring-iam's shapes: /api/auth and /api/authz/me are wrapped
 * in { success, message, data }, /api/v1 returns raw bodies, pages are
 * PageResponse. Every change is added to the admin-action audit log.
 */
import type {
  AdminAction,
  Assignment,
  AuditEntry,
  DenyRule,
  Group,
  GroupMember,
  IdentityAdmin,
  Permission,
  Policy,
  ResourceGrant,
  Role,
  Scope,
  SecurityEvent,
  ServiceRegistryEntry,
  Session,
} from "./types";

/* --------------------------------- Seed --------------------------------- */

let n = 0;
const id = (prefix: string) =>
  `${prefix}${(++n).toString(16).padStart(4, "0")}-4c1d-4e2a-9b7f-${(n * 7919).toString(16).padStart(12, "0")}`;
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const scope = (name: string, code: string, type: string, parent: Scope | null): Scope => ({
  id: id("5c0e"),
  type,
  name,
  code,
  parentId: parent?.id ?? null,
  path: parent ? `${parent.path}/${code}` : `/${code}`,
  depth: parent ? parent.depth + 1 : 0,
  active: true,
  createdAt: ago(60 * 24 * 90),
});
const root = scope("Acme", "acme", "ORG", null);
const np = scope("Nepal", "np", "COUNTRY", root);
const ktm = scope("Kathmandu", "ktm", "BRANCH", np);
const pkr = scope("Pokhara", "pkr", "BRANCH", np);
const inScope = scope("India", "in", "COUNTRY", root);
const scopes: Scope[] = [root, np, ktm, pkr, inScope];

const perm = (key: string, description: string): Permission => {
  const [domain, resource, action] = key.split(".");
  return { id: id("9e7a"), key, domain, resource, action, description };
};
const permissions: Permission[] = [
  ...["identity", "role", "scope", "assignment", "permission", "policy", "deny_rule"].flatMap(
    (r) => [
      perm(`platform.${r}.read`, `Read ${r.replace("_", " ")}s`),
      perm(`platform.${r}.create`, `Create ${r.replace("_", " ")}s`),
    ],
  ),
  perm("platform.identity.update", "Update users"),
  perm("platform.identity.suspend", "Suspend users"),
  perm("platform.assignment.revoke", "Revoke assignments"),
  perm("platform.deny_rule.delete", "Remove deny rules"),
  perm("platform.audit.read", "Read the audit log"),
  perm("orders.order.read", "View orders"),
  perm("orders.order.create", "Create orders"),
  perm("orders.order.refund", "Refund orders"),
  perm("payroll.payslip.read", "View payslips"),
  { ...perm("orders.order.export", "Export orders as CSV"), isDeprecated: true },
];
const keys = (pred: (k: string) => boolean) =>
  permissions.filter((p) => pred(p.key)).map((p) => p.id);

const role = (
  name: string,
  displayName: string,
  description: string,
  ids: string[],
  system = false,
): Role & { permissionIds: string[] } => ({
  id: id("801e"),
  name,
  displayName,
  description,
  isSystemRole: system,
  ownerScopeId: null,
  active: true,
  permissionIds: ids,
});
const superAdmin = role(
  "SuperAdmin",
  "Super admin",
  "Everything, everywhere.",
  keys(() => true),
  true,
);
const auditViewer = role(
  "AuditViewer",
  "Audit viewer",
  "Reads configuration and the audit log.",
  keys((k) => k.endsWith(".read")),
  true,
);
const branchManager = role(
  "BranchManager",
  "Branch manager",
  "Runs orders for one branch.",
  keys((k) => k.startsWith("orders.") && !k.endsWith("export")),
);
const cashier = role(
  "Cashier",
  "Cashier",
  "Creates and views orders.",
  keys((k) => k === "orders.order.read" || k === "orders.order.create"),
);
const roles = [superAdmin, auditViewer, branchManager, cashier];

const person = (
  email: string,
  displayName: string,
  extra: Partial<IdentityAdmin> = {},
): IdentityAdmin => ({
  id: id("1d00"),
  email,
  displayName,
  emailVerified: true,
  accountStatus: "ACTIVE",
  mfaEnabled: true,
  lastLoginAt: ago(Math.floor(Math.random() * 3000)),
  lastLoginIp: "203.0.113." + Math.floor(Math.random() * 200),
  createdAt: ago(60 * 24 * 120),
  failedLoginAttempts: 0,
  ...extra,
});
const admin = person("admin@example.com", "Asha Shrestha");
const auditor = person("auditor@example.com", "Bikash Rai");
const identities: IdentityAdmin[] = [
  admin,
  auditor,
  person("sita.gurung@example.com", "Sita Gurung"),
  person("ram.thapa@example.com", "Ram Thapa", { mfaEnabled: false }),
  person("priya.sharma@example.com", "Priya Sharma"),
  person("dev.k@example.com", "Dev Karki", {
    accountStatus: "LOCKED",
    failedLoginAttempts: 5,
    mfaEnabled: false,
  }),
  person("old.contractor@example.com", "Former contractor", {
    accountStatus: "SUSPENDED",
    mfaEnabled: false,
  }),
  person("new.hire@example.com", "", {
    emailVerified: false,
    mfaEnabled: false,
    lastLoginAt: null,
  }),
];
const [, , sita, ram, priya] = identities;

const assign = (
  who: IdentityAdmin,
  r: Role,
  s: Scope,
  extra: Partial<Assignment> = {},
): Assignment => ({
  id: id("a551"),
  subjectId: who.id,
  subjectType: "USER",
  roleId: r.id,
  scopeId: s.id,
  origin: "manual",
  grantedBy: admin.id,
  grantedAt: ago(60 * 24 * 30),
  expiresAt: null,
  active: true,
  ...extra,
});
const assignments: Assignment[] = [
  assign(admin, superAdmin, root),
  assign(auditor, auditViewer, root),
  assign(sita, branchManager, ktm),
  assign(ram, cashier, ktm, { expiresAt: ahead(3) }),
  assign(priya, branchManager, pkr),
];

const denyRules: DenyRule[] = [
  {
    id: id("de41"),
    subjectId: ram.id,
    subjectType: "USER",
    permissionKey: "orders.order.refund",
    scopeId: ktm.id,
    reason: "Refunds need a manager while on probation",
    referenceId: "HR-112",
    createdAt: ago(60 * 24 * 5),
    expiresAt: ahead(25),
    active: true,
  },
];

const policies: Policy[] = [
  {
    id: id("90c1"),
    name: "Refunds in office hours only",
    description: "Deny refunds outside 09:00 to 18:00 local time.",
    permissionKey: "orders.order.refund",
    resourceType: "order",
    effect: "DENY",
    enforcementMode: "ENFORCE",
    priority: 100,
    conditions: { not: { timeBetween: ["09:00", "18:00"] } },
    active: true,
  },
  {
    id: id("90c1"),
    name: "Large refunds need a second approver",
    description: "Trialled in shadow mode before enforcing.",
    permissionKey: "orders.order.refund",
    resourceType: "order",
    effect: "DENY",
    enforcementMode: "SHADOW",
    priority: 200,
    conditions: { gt: [{ attr: "resource.amount" }, 50000] },
    active: true,
  },
];

const grants: ResourceGrant[] = [
  {
    id: id("6a47"),
    subjectId: priya.id,
    subjectType: "USER",
    permissionKey: "orders.order.read",
    resourceType: "order",
    resourceId: "ORD-20931",
    scopeId: ktm.id,
    grantedAt: ago(600),
    expiresAt: ahead(2),
  },
];

const groups: Group[] = [
  { id: id("6e0b"), name: "night-shift", description: "Cashiers on the night rota", active: true },
  { id: id("6e0b"), name: "finance", description: "Finance team", active: true },
];
const members: GroupMember[] = [
  { groupId: groups[0].id, subjectId: ram.id, addedAt: ago(9000) },
  { groupId: groups[1].id, subjectId: priya.id, addedAt: ago(20000) },
];

const services: ServiceRegistryEntry[] = [
  {
    id: id("5e7c"),
    name: "orders-api",
    displayName: "Orders API",
    ownedDomains: ["orders"],
    active: true,
    lastSeenAt: ago(2),
  },
  {
    id: id("5e7c"),
    name: "payroll",
    displayName: "Payroll",
    ownedDomains: ["payroll"],
    active: true,
    lastSeenAt: ago(60 * 26),
  },
];

const actions: AdminAction[] = [
  ["POST", "/api/v1/assignments", 201, 30],
  ["PUT", `/api/v1/identities/${identities[6].id}/status`, 200, 95],
  ["POST", "/api/v1/deny-rules", 201, 60 * 24 * 5],
  ["PUT", `/api/v1/roles/${branchManager.id}/permissions`, 200, 60 * 24 * 6],
  ["POST", "/api/v1/policies", 201, 60 * 24 * 9],
  ["DELETE", "/api/v1/assignments/3f1c2a9e", 200, 60 * 24 * 11],
  ["POST", "/api/v1/scopes", 403, 60 * 24 * 12],
].map(([method, path, status, m]) => ({
  id: id("ad01"),
  actorId: admin.id,
  actorEmail: admin.email,
  method: method as string,
  path: path as string,
  status: status as number,
  ip: "203.0.113.24",
  createdAt: ago(m as number),
}));

const events: SecurityEvent[] = (
  [
    ["LOGIN_SUCCESS", admin, 4],
    ["LOGIN_FAILED", identities[5], 50],
    ["LOGIN_FAILED", identities[5], 51],
    ["ACCOUNT_LOCKED", identities[5], 52],
    ["MFA_ENABLED", sita, 60 * 30],
    ["ACCOUNT_SUSPENDED", identities[6], 95],
    ["PASSWORD_CHANGED", priya, 60 * 50],
    ["LOGIN_SUCCESS", auditor, 60 * 3],
  ] as const
).map(([eventType, who, m]) => ({
  id: id("5ec0"),
  identityId: who.id,
  eventType,
  ipAddress: "198.51.100." + (m % 200),
  createdAt: ago(m),
}));

const decisions: AuditEntry[] = [
  ["orders.order.refund", false, "Denied by deny rule (HR-112)", 40],
  ["orders.order.create", true, "Allowed by role Cashier in /acme/np/ktm", 41],
  ["orders.order.read", true, "Allowed by role Cashier in /acme/np/ktm", 42],
  ["payroll.payslip.read", false, "No role grants this permission", 300],
].map(([permissionKey, decision, reason, m]) => ({
  id: id("dec0"),
  timestamp: ago(m as number),
  subjectId: ram.id,
  permissionKey: permissionKey as string,
  scopeId: ktm.id,
  decision: decision as boolean,
  reason: reason as string,
  ipAddress: "198.51.100.7",
}));

let sessions: Session[] = [
  {
    id: id("5e55"),
    deviceLabel: "Chrome on macOS",
    createdIp: "203.0.113.24",
    createdAt: ago(60 * 5),
    lastUsedAt: ago(1),
  },
  {
    id: id("5e55"),
    deviceLabel: "Safari on iPhone",
    createdIp: "198.51.100.40",
    createdAt: ago(60 * 24 * 3),
    lastUsedAt: ago(60 * 20),
  },
];

/* ------------------------------- Responses ------------------------------ */

type Reply = [status: number, body?: unknown];
const ok = (data?: unknown, message = "OK"): Reply => [200, { success: true, message, data }];
const raw = (body: unknown, status = 200): Reply => [status, body];
const fail = (status: number, message: string): Reply => [status, { status, message }];
const page = <T>(items: T[], q: URLSearchParams): Reply => {
  const size = Number(q.get("size") ?? 50);
  const number = Number(q.get("page") ?? 0);
  return raw({
    content: items.slice(number * size, number * size + size),
    totalElements: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
    number,
    size,
  });
};

const SESSION_KEY = "access-control-demo:user";
const signedIn = (): IdentityAdmin | undefined => {
  try {
    return identities.find((i) => i.id === sessionStorage.getItem(SESSION_KEY));
  } catch {
    return undefined;
  }
};
const tokens = (who: IdentityAdmin) => ({
  accessToken: "demo",
  tokenType: "Bearer",
  expiresIn: 900,
  identity: {
    id: who.id,
    email: who.email,
    displayName: who.displayName,
    emailVerified: true,
    mfaEnabled: who.mfaEnabled,
  },
});
const permsOf = (who: IdentityAdmin) => {
  const ids = new Set(
    assignments
      .filter((a) => a.subjectId === who.id && a.active !== false)
      .flatMap((a) => roles.find((r) => r.id === a.roleId)?.permissionIds ?? []),
  );
  return permissions.filter((p) => ids.has(p.id)).map((p) => p.key);
};

type Ctx = { q: URLSearchParams; body: Record<string, unknown>; p: string[]; me?: IdentityAdmin };
type Handler = (c: Ctx) => Reply;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, pattern: string, h: Handler) =>
  routes.push([method, new RegExp(`^${pattern.replace(/:\w+/g, "([^/]+)")}$`), h]);
const s = (v: unknown) => (typeof v === "string" ? v : "");

/* --------------------------------- Auth --------------------------------- */

on("POST", "/api/auth/login", ({ body }) => {
  const who = identities.find((i) => i.email === s(body.email).toLowerCase());
  if (!who || body.password === "wrong") return fail(401, "Invalid email or password");
  if (who.accountStatus !== "ACTIVE")
    return fail(403, "This account is " + who.accountStatus.toLowerCase());
  sessionStorage.setItem(SESSION_KEY, who.id);
  return ok(tokens(who), "Login successful");
});
on("POST", "/api/auth/refresh", () => {
  const who = signedIn();
  return who ? ok(tokens(who)) : fail(401, "No session");
});
on("POST", "/api/auth/logout", () => {
  sessionStorage.removeItem(SESSION_KEY);
  return ok(undefined, "Logged out");
});
on("POST", "/api/auth/logout-all", () => {
  sessions = sessions.slice(0, 1);
  return ok(undefined, "All other sessions revoked");
});
on("POST", "/api/auth/change-password", ({ body }) =>
  body.currentPassword === "wrong"
    ? fail(400, "Current password is incorrect")
    : ok(undefined, "Password changed"),
);
on("GET", "/api/auth/sessions", () => ok(sessions));
on("DELETE", "/api/auth/sessions/:id", ({ p }) => {
  sessions = sessions.filter((x) => x.id !== p[0]);
  return ok();
});

/* --------------------------------- Authz -------------------------------- */

on("GET", "/api/authz/me/scopes", ({ me }) => {
  const mine = new Set(assignments.filter((a) => a.subjectId === me?.id).map((a) => a.scopeId));
  return ok(
    scopes
      .filter((x) => mine.has(x.id))
      .map(({ id, type, name, code }) => ({ id, type, name, code })),
  );
});
on("GET", "/api/authz/me/permissions", ({ me }) => ok(me ? permsOf(me) : []));
on("GET", "/api/v1/meta/features", () =>
  raw({
    "resource-grants": true,
    groups: true,
    "service-registry": true,
    oauth2: true,
    "break-glass": true,
    introspection: false,
    "revocation-feed": false,
  }),
);
on("POST", "/api/v1/authorize/explain", ({ body }) => {
  const subject = s(body.subject);
  const key = s(body.permission);
  const scopeId = s((body.resource as { scopeId?: string })?.scopeId);
  const who = identities.find((i) => i.id === subject || i.email === subject);
  const steps: { name: string; outcome: string; detail: string }[] = [];
  const deny = denyRules.find((d) => d.subjectId === who?.id && d.permissionKey === key);
  if (deny) {
    steps.push({ name: "deny_rules", outcome: "DENY", detail: `Deny rule: ${deny.reason}` });
    return raw({ allowed: false, reason: "Denied by an explicit deny rule", steps });
  }
  steps.push({ name: "deny_rules", outcome: "PASS", detail: "No deny rule matches." });
  const target = scopes.find((x) => x.id === scopeId);
  const hit = assignments.find((a) => {
    const r = roles.find((x) => x.id === a.roleId);
    const at = scopes.find((x) => x.id === a.scopeId);
    const perm = permissions.find((x) => x.key === key);
    return (
      a.subjectId === who?.id &&
      !!perm &&
      r?.permissionIds.includes(perm.id) &&
      !!at &&
      !!target &&
      target.path.startsWith(at.path)
    );
  });
  if (!hit) {
    steps.push({
      name: "rbac_scope",
      outcome: "FAIL",
      detail: "No role in this scope, or above it, grants the permission.",
    });
    steps.push({ name: "resource_grants", outcome: "FAIL", detail: "No grant on this resource." });
    return raw({ allowed: false, reason: "No role or grant gives this permission", steps });
  }
  const r = roles.find((x) => x.id === hit.roleId)!;
  steps.push({
    name: "rbac_scope",
    outcome: "PASS",
    detail: `Role ${r.displayName} at ${scopes.find((x) => x.id === hit.scopeId)?.path}.`,
  });
  steps.push({ name: "conditions", outcome: "PASS", detail: "The assignment has no conditions." });
  steps.push({
    name: "resource_grants",
    outcome: "SKIP",
    detail: "Not needed: a role already allows it.",
  });
  const pol = policies.find(
    (x) => x.permissionKey === key && x.enforcementMode === "ENFORCE" && x.active,
  );
  if (pol)
    steps.push({
      name: "policies",
      outcome: "PASS",
      detail: `"${pol.name}" checked; its conditions don't apply right now.`,
    });
  else steps.push({ name: "policies", outcome: "SKIP", detail: "No policy for this permission." });
  return raw({ allowed: true, reason: `Allowed by role ${r.displayName}`, steps });
});

/* ------------------------------ Admin data ------------------------------ */

on("GET", "/api/v1/identities", ({ q }) => {
  const text = (q.get("query") ?? "").toLowerCase();
  const status = q.get("status");
  return raw(
    identities.filter(
      (i) =>
        (!status || i.accountStatus === status) &&
        (!text || i.email.includes(text) || (i.displayName ?? "").toLowerCase().includes(text)),
    ),
  );
});
on("GET", "/api/v1/identities/:id", ({ p }) => {
  const i = identities.find((x) => x.id === p[0]);
  return i ? raw(i) : fail(404, "User not found");
});
on("POST", "/api/v1/identities", ({ body }) => {
  const email = s(body.email).toLowerCase();
  if (identities.some((i) => i.email === email))
    return fail(409, "A user with this email already exists");
  const i = person(email, "", {
    emailVerified: !!body.emailVerified,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
  });
  identities.unshift(i);
  return raw(
    { identity: i, temporaryPassword: "Tmp-" + Math.random().toString(36).slice(2, 10) },
    201,
  );
});
const updateIdentity = (idv: string, change: Partial<IdentityAdmin>): Reply => {
  const i = identities.find((x) => x.id === idv);
  if (!i) return fail(404, "User not found");
  Object.assign(i, change);
  return raw(i);
};
on("PUT", "/api/v1/identities/:id/status", ({ p, body }) =>
  updateIdentity(p[0], { accountStatus: s(body.status), failedLoginAttempts: 0 }),
);
on("PUT", "/api/v1/identities/:id/email-verified", ({ p }) =>
  updateIdentity(p[0], { emailVerified: true }),
);
on("PUT", "/api/v1/identities/:id/password", () =>
  raw({ temporaryPassword: "Tmp-" + Math.random().toString(36).slice(2, 10), sessionsRevoked: 2 }),
);
on(
  "DELETE",
  "/api/v1/identities/:id/mfa",
  ({ p }) => (updateIdentity(p[0], { mfaEnabled: false }), raw(null, 204)),
);

on("GET", "/api/v1/scopes", () => raw(scopes));
on("POST", "/api/v1/scopes", ({ body }) => {
  const parent = scopes.find((x) => x.id === body.parentId) ?? null;
  const name = s(body.name);
  const created = scope(
    name,
    s(body.code) || name.toLowerCase().replace(/\W+/g, "-"),
    s(body.type) || "UNIT",
    parent,
  );
  scopes.push(created);
  return raw(created, 201);
});
on("POST", "/api/v1/scopes/:id/move", ({ p, body }) => {
  const x = scopes.find((v) => v.id === p[0]);
  const parent = scopes.find((v) => v.id === body.newParentId);
  if (!x || !parent) return fail(404, "Scope not found");
  if (parent.path.startsWith(x.path)) return fail(400, "A scope can't move under itself");
  x.parentId = parent.id;
  x.path = `${parent.path}/${x.code}`;
  x.depth = parent.depth + 1;
  return raw(x);
});

on("GET", "/api/v1/roles", () => raw(roles.map(({ permissionIds: _, ...r }) => r)));
on("GET", "/api/v1/roles/:id/permissions", ({ p }) => {
  const r = roles.find((x) => x.id === p[0]);
  return raw(permissions.filter((x) => r?.permissionIds.includes(x.id)));
});
on("POST", "/api/v1/roles", ({ body }) => {
  const r = role(
    s(body.name),
    s(body.displayName),
    s(body.description),
    (body.permissionIds as string[]) ?? [],
  );
  roles.push(r);
  return raw(r, 201);
});
on("PUT", "/api/v1/roles/:id/permissions", ({ p, body }) => {
  const r = roles.find((x) => x.id === p[0]);
  if (!r) return fail(404, "Role not found");
  if (r.isSystemRole) return fail(400, "System roles can't be changed");
  r.permissionIds = body as unknown as string[];
  return raw(null);
});
on("GET", "/api/v1/permissions", () => raw(permissions));

on("GET", "/api/v1/assignments", ({ q }) => {
  const sub = q.get("subjectId");
  return raw(assignments.filter((a) => a.active !== false && (!sub || a.subjectId === sub)));
});
on("POST", "/api/v1/assignments", ({ body, me }) => {
  const a: Assignment = {
    id: id("a551"),
    subjectId: s(body.subjectId),
    subjectType: s(body.subjectType) || "USER",
    roleId: s(body.roleId),
    scopeId: s(body.scopeId),
    origin: "manual",
    grantedBy: me?.id,
    grantedAt: new Date().toISOString(),
    expiresAt: (body.expiresAt as string) || null,
    active: true,
  };
  assignments.unshift(a);
  return raw(a, 201);
});
on("DELETE", "/api/v1/assignments/:id", ({ p }) => {
  const a = assignments.find((x) => x.id === p[0]);
  if (a) a.active = false;
  return raw(null);
});
on("POST", "/api/v1/break-glass", ({ body, me }) => {
  const a: Assignment = {
    id: id("a551"),
    subjectId: s(body.subjectId),
    subjectType: "USER",
    roleId: s(body.roleId),
    scopeId: s(body.scopeId),
    origin: "break-glass",
    grantedBy: me?.id,
    grantedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + Number(body.durationMinutes ?? 60) * 60_000).toISOString(),
    active: true,
  };
  assignments.unshift(a);
  return raw(a, 201);
});

on("GET", "/api/v1/deny-rules", ({ q }) =>
  raw(denyRules.filter((d) => d.subjectId === q.get("subjectId"))),
);
on("POST", "/api/v1/deny-rules", ({ body }) => {
  const d = {
    ...(body as unknown as DenyRule),
    id: id("de41"),
    createdAt: new Date().toISOString(),
    active: true,
  };
  denyRules.unshift(d);
  return raw(d, 201);
});
on("DELETE", "/api/v1/deny-rules/:id", ({ p }) => {
  const i = denyRules.findIndex((d) => d.id === p[0]);
  if (i >= 0) denyRules.splice(i, 1);
  return raw(null);
});

on("GET", "/api/v1/policies", () => raw(policies));
on("POST", "/api/v1/policies", ({ body }) => {
  const x = { ...(body as unknown as Policy), id: id("90c1"), active: true };
  policies.push(x);
  return raw(x, 201);
});
on("PUT", "/api/v1/policies/:id", ({ p, body }) => {
  const x = policies.find((v) => v.id === p[0]);
  if (!x) return fail(404, "Policy not found");
  const { name: _ignored, ...rest } = body as Partial<Policy>; // spring-iam can't rename
  Object.assign(x, rest);
  return raw(x);
});
on("DELETE", "/api/v1/policies/:id", ({ p }) => {
  const x = policies.find((v) => v.id === p[0]);
  if (x) x.active = false;
  return raw(null);
});

on("GET", "/api/v1/resource-grants", ({ q }) => {
  const sub = q.get("subjectId");
  const rt = q.get("resourceType");
  const ri = q.get("resourceId");
  if (!sub && !(rt && ri)) return fail(400, "Give a subjectId, or a resourceType and resourceId");
  return raw(
    grants.filter((g) =>
      sub ? g.subjectId === sub : g.resourceType === rt && g.resourceId === ri,
    ),
  );
});
on("POST", "/api/v1/resource-grants", ({ body }) => {
  const g = {
    ...(body as unknown as ResourceGrant),
    id: id("6a47"),
    grantedAt: new Date().toISOString(),
  };
  grants.unshift(g);
  return raw(g, 201);
});
on("DELETE", "/api/v1/resource-grants/:id", ({ p }) => {
  const i = grants.findIndex((g) => g.id === p[0]);
  if (i >= 0) grants.splice(i, 1);
  return raw(null, 204);
});

on("GET", "/api/v1/groups", () => raw(groups));
on("POST", "/api/v1/groups", ({ body }) => {
  const g = { id: id("6e0b"), name: s(body.name), description: s(body.description), active: true };
  groups.push(g);
  return raw(g, 201);
});
on("GET", "/api/v1/groups/:id/members", ({ p }) => raw(members.filter((m) => m.groupId === p[0])));
on("POST", "/api/v1/groups/:id/members", ({ p, body }) => {
  members.push({ groupId: p[0], subjectId: s(body.subjectId), addedAt: new Date().toISOString() });
  return raw(null, 201);
});
on("DELETE", "/api/v1/groups/:id/members/:sid", ({ p }) => {
  const i = members.findIndex((m) => m.groupId === p[0] && m.subjectId === p[1]);
  if (i >= 0) members.splice(i, 1);
  return raw(null, 204);
});

on("GET", "/api/v1/services", () => raw(services));
on("POST", "/api/v1/services", ({ body }) => {
  const x = {
    id: id("5e7c"),
    name: s(body.name),
    displayName: s(body.displayName),
    ownedDomains: (body.ownedDomains as string[]) ?? [],
    active: true,
    lastSeenAt: null,
  };
  services.push(x);
  return raw({ ...x, apiKey: "demo_sk_" + Math.random().toString(36).slice(2, 14) }, 201);
});

on("GET", "/api/v1/audit/subject/:id", ({ p }) =>
  raw(decisions.filter((d) => d.subjectId === p[0])),
);
on("GET", "/api/v1/audit/admin-actions", ({ q }) => page(actions, q));
on("GET", "/api/v1/audit/security-events", ({ q }) =>
  page(
    [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    q,
  ),
);

/* -------------------------------- Router -------------------------------- */

const READ_ONLY = new Set(["/api/v1/authorize/explain"]);

export async function demoFetch(
  method: string,
  path: string,
  query: Record<string, unknown> | undefined,
  body: unknown,
): Promise<Response> {
  await new Promise((r) => setTimeout(r, 250));
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v != null && v !== "") q.set(k, String(v));

  const me = signedIn();
  let reply: Reply = fail(404, `No demo data for ${method} ${path}`);
  const open = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/refresh");

  if (!me && !open) {
    reply = fail(401, "Sign in first");
  } else {
    for (const [m, re, h] of routes) {
      const match = m === method && re.exec(path);
      if (!match) continue;
      const writes = method !== "GET" && path.startsWith("/api/v1/") && !READ_ONLY.has(path);
      // The auditor is read-only, like an AuditViewer in spring-iam.
      reply =
        writes && me === auditor
          ? fail(403, "Access denied")
          : h({ q, body: (body ?? {}) as Record<string, unknown>, p: match.slice(1), me });
      if (writes) {
        actions.unshift({
          id: id("ad01"),
          actorId: me?.id,
          actorEmail: me?.email,
          method,
          path,
          status: reply[0],
          ip: "203.0.113.24",
          createdAt: new Date().toISOString(),
        });
      }
      break;
    }
  }

  const [status, json] = reply;
  return status === 204 || json === undefined || json === null
    ? new Response(null, { status: status === 200 && json === null ? 200 : status })
    : Response.json(json, { status });
}
