import { api } from "./client";
import type {
  AccountStatus,
  AdminAction,
  Assignment,
  AuditEntry,
  AuthorizationRequest,
  DenyRule,
  ExplainResult,
  FeatureFlags,
  Group,
  GroupMember,
  IdentityAdmin,
  LoginResult,
  PageResponse,
  Permission,
  Policy,
  ResourceGrant,
  Role,
  Scope,
  ScopeSummary,
  SecurityEvent,
  ServiceRegistryEntry,
  Session,
} from "./types";

// Every path and field below matches spring-iam's controllers and DTOs.

/* --------------------------------- Auth --------------------------------- */

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResult>("/api/auth/login", { email, password }),
  mfaVerify: (challenge: string, code: string) =>
    api.post<LoginResult>("/api/auth/mfa/verify", { challenge, code }),
  logout: () => api.post("/api/auth/logout"),
  logoutAll: () => api.post("/api/auth/logout-all"),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post("/api/auth/change-password", {
      currentPassword,
      newPassword,
      confirmPassword: newPassword,
    }),
  sessions: () => api.get<Session[]>("/api/auth/sessions"),
  revokeSession: (id: string) => api.del(`/api/auth/sessions/${id}`),
};

/* --------------------------------- Authz -------------------------------- */

export const authzApi = {
  myScopes: () => api.get<ScopeSummary[]>("/api/authz/me/scopes"),
  myPermissions: (scopeId: string) => api.get<string[]>("/api/authz/me/permissions", { scopeId }),
  explain: (input: AuthorizationRequest) =>
    api.post<ExplainResult>("/api/v1/authorize/explain", input),
};

export const metaApi = {
  features: () => api.get<FeatureFlags>("/api/v1/meta/features"),
};

/* --------------------------------- Users -------------------------------- */

export const identitiesApi = {
  list: (params: { query?: string; status?: string; limit?: number; page?: number } = {}) =>
    api.get<IdentityAdmin[]>("/api/v1/identities", { limit: 50, ...params }),
  get: (id: string) => api.get<IdentityAdmin>(`/api/v1/identities/${id}`),
  create: (input: { email: string; password?: string; emailVerified?: boolean }) =>
    api.post<{ identity: IdentityAdmin; temporaryPassword?: string | null }>(
      "/api/v1/identities",
      input,
    ),
  setStatus: (id: string, status: AccountStatus, reason: string) =>
    api.put<IdentityAdmin>(`/api/v1/identities/${id}/status`, { status, reason }),
  resetPassword: (id: string) =>
    api.put<{ temporaryPassword?: string | null; sessionsRevoked?: number }>(
      `/api/v1/identities/${id}/password`,
      { revokeSessions: true },
    ),
  resetMfa: (id: string) => api.del(`/api/v1/identities/${id}/mfa`),
  markEmailVerified: (id: string) =>
    api.put<IdentityAdmin>(`/api/v1/identities/${id}/email-verified`),
};

/* --------------------------------- Scopes ------------------------------- */

export const scopesApi = {
  list: () => api.get<Scope[]>("/api/v1/scopes"),
  create: (input: { type: string; name: string; code?: string; parentId?: string | null }) =>
    api.post<Scope>("/api/v1/scopes", input),
  move: (id: string, newParentId: string) => api.post(`/api/v1/scopes/${id}/move`, { newParentId }),
};

/* --------------------------------- Roles -------------------------------- */

export const rolesApi = {
  list: () => api.get<Role[]>("/api/v1/roles"),
  permissions: (id: string) => api.get<Permission[]>(`/api/v1/roles/${id}/permissions`),
  create: (input: {
    name: string;
    displayName?: string;
    description?: string;
    ownerScopeId?: string | null;
    permissionIds: string[];
  }) => api.post<Role>("/api/v1/roles", input),
  updatePermissions: (id: string, permissionIds: string[]) =>
    api.put(`/api/v1/roles/${id}/permissions`, permissionIds),
};

export const permissionsApi = {
  list: () => api.get<Permission[]>("/api/v1/permissions"),
};

/* ------------------------------ Assignments ----------------------------- */

export const assignmentsApi = {
  list: (params?: { subjectId?: string }) => api.get<Assignment[]>("/api/v1/assignments", params),
  create: (input: {
    subjectId: string;
    subjectType: string;
    roleId: string;
    scopeId: string;
    expiresAt?: string | null;
    conditions?: unknown;
  }) => api.post<Assignment>("/api/v1/assignments", input),
  revoke: (id: string, reason: string) => api.del(`/api/v1/assignments/${id}`, { reason }),
};

export const breakGlassApi = {
  grant: (input: {
    subjectId: string;
    roleId: string;
    scopeId: string;
    durationMinutes: number;
    reason: string;
    referenceId?: string;
  }) => api.post<Assignment>("/api/v1/break-glass", input),
};

/* ------------------------------ Deny Rules ------------------------------ */

export const denyRulesApi = {
  /** spring-iam lists deny rules per subject only. */
  forSubject: (subjectId: string) => api.get<DenyRule[]>("/api/v1/deny-rules", { subjectId }),
  create: (input: {
    subjectId: string;
    subjectType: string;
    permissionKey: string;
    scopeId?: string | null;
    reason: string;
    referenceId?: string | null;
    expiresAt?: string | null;
  }) => api.post<DenyRule>("/api/v1/deny-rules", input),
  del: (id: string) => api.del(`/api/v1/deny-rules/${id}`),
};

/* -------------------------------- Policies ------------------------------ */

export const policiesApi = {
  list: () => api.get<Policy[]>("/api/v1/policies"),
  create: (input: Partial<Policy>) => api.post<Policy>("/api/v1/policies", input),
  /** spring-iam can't rename a policy: `name` is ignored on update. */
  update: (id: string, input: Partial<Policy>) => api.put<Policy>(`/api/v1/policies/${id}`, input),
  deactivate: (id: string) => api.del(`/api/v1/policies/${id}`),
};

/* ----------------------------- Resource Grants -------------------------- */

export const resourceGrantsApi = {
  /** Needs a subject, or a resource type and id: spring-iam has no list-all. */
  find: (params: { subjectId?: string; resourceType?: string; resourceId?: string }) =>
    api.get<ResourceGrant[]>("/api/v1/resource-grants", params),
  create: (input: Partial<ResourceGrant>) =>
    api.post<ResourceGrant>("/api/v1/resource-grants", input),
  del: (id: string) => api.del(`/api/v1/resource-grants/${id}`),
};

/* -------------------------------- Groups -------------------------------- */

export const groupsApi = {
  list: () => api.get<Group[]>("/api/v1/groups"),
  create: (input: { name: string; description?: string }) =>
    api.post<Group>("/api/v1/groups", input),
  members: (id: string) => api.get<GroupMember[]>(`/api/v1/groups/${id}/members`),
  addMember: (id: string, subjectId: string) =>
    api.post(`/api/v1/groups/${id}/members`, { subjectId }),
  removeMember: (id: string, subjectId: string) =>
    api.del(`/api/v1/groups/${id}/members/${subjectId}`),
};

/* -------------------------------- Services ------------------------------ */

export const servicesApi = {
  list: () => api.get<ServiceRegistryEntry[]>("/api/v1/services"),
  create: (input: { name: string; displayName?: string; ownedDomains: string[] }) =>
    api.post<ServiceRegistryEntry & { apiKey: string }>("/api/v1/services", input),
};

/* --------------------------------- Audit -------------------------------- */

export const auditApi = {
  bySubject: (subjectId: string, limit = 100) =>
    api.get<AuditEntry[]>(`/api/v1/audit/subject/${subjectId}`, { limit }),
  adminActions: (page = 0, size = 50) =>
    api.get<PageResponse<AdminAction>>("/api/v1/audit/admin-actions", { page, size }),
  securityEvents: (page = 0, size = 50) =>
    api.get<PageResponse<SecurityEvent>>("/api/v1/audit/security-events", { page, size }),
};
