// Shapes returned by spring-iam. Field names follow its DTOs exactly.

export type Identity = {
  id: string;
  email: string;
  displayName?: string | null;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
};

export type TokenResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  identity: Identity;
};

/** Login, MFA verify and OAuth exchange all end in one of these. */
export type LoginResult =
  | TokenResult
  | { status: "MFA_REQUIRED"; challenge: string }
  | { status: "MFA_ENROLLMENT_REQUIRED"; enrollmentToken: string };

export type Scope = {
  id: string;
  type: string;
  name: string;
  code: string;
  parentId: string | null;
  path: string;
  depth: number;
  metadata?: Record<string, unknown> | null;
  active: boolean;
  createdAt?: string;
};

/** /api/authz/me/scopes: the scopes where the signed-in user holds an assignment. */
export type ScopeSummary = { id: string; type: string; name: string; code: string };

export type Permission = {
  id: string;
  key: string;
  domain?: string;
  resource?: string;
  action?: string;
  description?: string;
  isDeprecated?: boolean;
};

export type Role = {
  id: string;
  name: string;
  displayName?: string | null;
  description?: string | null;
  isSystemRole?: boolean;
  orgType?: string | null;
  ownerScopeId: string | null;
  active?: boolean;
};

export type Assignment = {
  id: string;
  subjectId: string;
  subjectType: string;
  roleId: string;
  scopeId: string;
  origin?: string | null;
  grantedBy?: string | null;
  grantedAt?: string;
  expiresAt?: string | null;
  conditions?: unknown;
  active?: boolean;
};

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type DenyRule = {
  id: string;
  subjectId: string;
  subjectType: string;
  permissionKey: string;
  scopeId?: string | null;
  reason: string;
  referenceId?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  active?: boolean;
};

export type Policy = {
  id: string;
  name: string;
  description?: string | null;
  permissionKey?: string | null;
  resourceType?: string | null;
  scopeId?: string | null;
  effect: string;
  enforcementMode: "ENFORCE" | "SHADOW";
  priority: number;
  conditions?: unknown;
  active?: boolean;
};

export type ResourceGrant = {
  id: string;
  subjectId: string;
  subjectType?: string;
  permissionKey: string;
  resourceType: string;
  resourceId: string;
  scopeId?: string | null;
  grantedAt?: string;
  expiresAt?: string | null;
};

export type Group = { id: string; name: string; description?: string | null; active?: boolean };

export type GroupMember = {
  groupId: string;
  subjectId: string;
  addedAt?: string;
  addedBy?: string;
};

export type ServiceRegistryEntry = {
  id: string;
  name: string;
  displayName?: string | null;
  ownedDomains: string[];
  active?: boolean;
  lastSeenAt?: string | null;
};

/** One authorization decision, from /api/v1/audit/subject/{id}. */
export type AuditEntry = {
  id: string;
  timestamp: string;
  subjectId: string;
  permissionKey: string;
  resourceType?: string | null;
  resourceId?: string | null;
  scopeId?: string | null;
  decision: boolean;
  reason?: string | null;
  ipAddress?: string | null;
};

/** One admin API call, from /api/v1/audit/admin-actions. */
export type AdminAction = {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  method: string;
  path: string;
  status: number;
  ip?: string | null;
  createdAt: string;
};

export type SecurityEvent = {
  id: string;
  identityId?: string | null;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type Session = {
  id: string;
  deviceLabel?: string;
  createdIp?: string;
  createdAt: string;
  lastUsedAt?: string;
};

export type FeatureFlags = {
  "resource-grants": boolean;
  groups: boolean;
  "service-registry": boolean;
  oauth2: boolean;
  "break-glass": boolean;
  introspection: boolean;
  "revocation-feed": boolean;
};

export type ExplainStep = {
  name: "deny_rules" | "rbac_scope" | "conditions" | "resource_grants" | "policies" | string;
  outcome: "PASS" | "FAIL" | "SKIP" | "ALLOW" | "DENY";
  detail?: string | null;
};

export type ExplainResult = { allowed: boolean; reason: string; steps: ExplainStep[] };

export type AuthorizationRequest = {
  subject: string;
  permission: string;
  resource: { type?: string; id?: string; scopeId: string };
};

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "LOCKED" | "DEACTIVATED" | string;

/** A user, as /api/v1/identities shows it to admins. */
export type IdentityAdmin = {
  id: string;
  email: string;
  displayName?: string | null;
  emailVerified: boolean;
  accountStatus: AccountStatus;
  mfaEnabled: boolean;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  createdAt: string;
  failedLoginAttempts?: number;
  accountLockedUntil?: string | null;
};
