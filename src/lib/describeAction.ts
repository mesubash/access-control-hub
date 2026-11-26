/**
 * Turn an admin-audit entry (HTTP method + path) into a sentence a person
 * reads at a glance: "PUT /api/v1/roles/…/permissions" → "Changed a role's permissions".
 * Unknown calls fall back to the raw request.
 */
const RULES: [method: string, pattern: RegExp, text: string][] = [
  ["POST", /^\/api\/v1\/identities$/, "Added a user"],
  ["PUT", /^\/api\/v1\/identities\/[^/]+\/status$/, "Changed a user's account status"],
  ["PUT", /^\/api\/v1\/identities\/[^/]+\/password$/, "Reset a user's password"],
  ["DELETE", /^\/api\/v1\/identities\/[^/]+\/mfa$/, "Reset a user's two-step verification"],
  ["PUT", /^\/api\/v1\/identities\/[^/]+\/email-verified$/, "Marked an email as verified"],
  ["PUT", /^\/api\/v1\/identities\/[^/]+\/display-name$/, "Renamed a user"],
  ["POST", /^\/api\/v1\/assignments$/, "Gave someone a role"],
  ["DELETE", /^\/api\/v1\/assignments\/[^/]+$/, "Took a role away"],
  ["POST", /^\/api\/v1\/break-glass$/, "Granted emergency access"],
  ["POST", /^\/api\/v1\/roles$/, "Created a role"],
  ["PUT", /^\/api\/v1\/roles\/[^/]+\/permissions$/, "Changed a role's permissions"],
  ["DELETE", /^\/api\/v1\/roles\/[^/]+$/, "Deleted a role"],
  ["POST", /^\/api\/v1\/scopes$/, "Created a scope"],
  ["POST", /^\/api\/v1\/scopes\/[^/]+\/move$/, "Moved a scope"],
  ["POST", /^\/api\/v1\/deny-rules$/, "Added a deny rule"],
  ["DELETE", /^\/api\/v1\/deny-rules\/[^/]+$/, "Removed a deny rule"],
  ["POST", /^\/api\/v1\/policies$/, "Created a policy"],
  ["PUT", /^\/api\/v1\/policies\/[^/]+$/, "Edited a policy"],
  ["DELETE", /^\/api\/v1\/policies\/[^/]+$/, "Turned off a policy"],
  ["POST", /^\/api\/v1\/resource-grants$/, "Granted access to one record"],
  ["DELETE", /^\/api\/v1\/resource-grants\/[^/]+$/, "Revoked access to one record"],
  ["POST", /^\/api\/v1\/groups$/, "Created a group"],
  ["POST", /^\/api\/v1\/groups\/[^/]+\/members$/, "Added someone to a group"],
  ["DELETE", /^\/api\/v1\/groups\/[^/]+\/members\/[^/]+$/, "Removed someone from a group"],
  ["POST", /^\/api\/v1\/services$/, "Registered a service"],
  ["PUT", /^\/api\/v1\/services\/[^/]+\/permissions$/, "Synced a service's permissions"],
];

export function describeAction(method: string, path: string): string {
  const clean = path.split("?")[0];
  const hit = RULES.find(([m, re]) => m === method && re.test(clean));
  return hit ? hit[2] : `${method} ${clean}`;
}

/** "Done", "Refused" (403) or "Failed (500)". */
export function describeResult(status: number): { label: string; ok: boolean } {
  if (status < 400) return { label: "Done", ok: true };
  if (status === 401 || status === 403) return { label: "Refused", ok: false };
  return { label: `Failed (${status})`, ok: false };
}
