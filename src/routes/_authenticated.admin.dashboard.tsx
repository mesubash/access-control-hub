import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

import {
  assignmentsApi,
  auditApi,
  identitiesApi,
  policiesApi,
  rolesApi,
  scopesApi,
} from "@/api/resources";
import type { AdminAction } from "@/api/types";
import { DataTable, type Column } from "@/components/iam/DataTable";
import { Tag } from "@/components/iam/badges";
import { PageHeader } from "@/components/iam/PageHeader";
import { When } from "@/components/iam/When";
import { useAuthz } from "@/context/AuthzContext";
import { pageTitle } from "@/lib/brand";
import { describeAction, describeResult } from "@/lib/describeAction";
import { isExpiring } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: pageTitle("Overview") }] }),
  component: DashboardPage,
});

type Item = {
  key: string;
  tone: "warning" | "destructive" | "neutral";
  text: ReactNode;
  to: string;
  cta: string;
};

const DOT = {
  destructive: "bg-[var(--destructive)]",
  warning: "bg-[var(--warning)]",
  neutral: "bg-[var(--muted-foreground)]/50",
};

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function DashboardPage() {
  const { can } = useAuthz();
  const users = useQuery({
    queryKey: ["identities", "all"],
    queryFn: () => identitiesApi.list({ limit: 200 }),
    enabled: can("platform.identity.read"),
  });
  const assignments = useQuery({
    queryKey: ["assignments"],
    queryFn: () => assignmentsApi.list(),
    enabled: can("platform.assignment.read"),
  });
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: policiesApi.list,
    enabled: can("platform.policy.read"),
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: rolesApi.list,
    enabled: can("platform.role.read"),
  });
  const scopes = useQuery({
    queryKey: ["scopes"],
    queryFn: scopesApi.list,
    enabled: can("platform.scope.read"),
  });
  const actions = useQuery({
    queryKey: ["audit", "admin", 0],
    queryFn: () => auditApi.adminActions(0),
    enabled: can("platform.audit.read"),
  });

  const u = users.data ?? [];
  const a = (assignments.data ?? []).filter((x) => x.active !== false);
  const p = (policies.data ?? []).filter((x) => x.active !== false);

  const locked = u.filter((x) => x.accountStatus === "LOCKED");
  const expiring = a.filter((x) => isExpiring(x.expiresAt));
  const shadow = p.filter((x) => x.enforcementMode === "SHADOW");
  const noMfa = u.filter((x) => x.accountStatus === "ACTIVE" && !x.mfaEnabled);
  const unverified = u.filter((x) => !x.emailVerified);

  // What an admin should look at, most urgent first. Empty groups are left out.
  const items = [
    locked.length > 0 && {
      key: "locked",
      tone: "destructive",
      text: `${plural(locked.length, "account")} locked after failed sign-ins`,
      to: "/admin/users",
      cta: "Review",
    },
    expiring.length > 0 && {
      key: "expiring",
      tone: "warning",
      text: `${plural(expiring.length, "role assignment")} expiring within a week`,
      to: "/admin/assignments",
      cta: "Check",
    },
    noMfa.length > 0 && {
      key: "mfa",
      tone: "warning",
      text: `${plural(noMfa.length, "active user")} without two-step verification`,
      to: "/admin/users",
      cta: "See who",
    },
    shadow.length > 0 && {
      key: "shadow",
      tone: "neutral",
      text: `${plural(shadow.length, "policy", "policies")} in shadow mode: logged, not enforced`,
      to: "/admin/policies",
      cta: "Decide",
    },
    unverified.length > 0 && {
      key: "unverified",
      tone: "neutral",
      text: `${plural(unverified.length, "user")} with an unverified email`,
      to: "/admin/users",
      cta: "See who",
    },
  ].filter(Boolean) as Item[];

  const loading = users.isLoading || assignments.isLoading || policies.isLoading;

  const summary = [
    scopes.data && plural(scopes.data.length, "scope"),
    roles.data && plural(roles.data.length, "role"),
    users.data && plural(u.length, "user"),
    assignments.data && plural(a.length, "active assignment"),
    policies.data && plural(p.length, "active policy", "active policies"),
  ].filter(Boolean);

  const columns: Column<AdminAction>[] = [
    { key: "t", header: "When", width: "130px", render: (x) => <When at={x.createdAt} /> },
    { key: "who", header: "Who", render: (x) => x.actorEmail ?? "—" },
    {
      key: "what",
      header: "Change",
      render: (x) => (
        <span title={`${x.method} ${x.path}`}>{describeAction(x.method, x.path)}</span>
      ),
    },
    {
      key: "s",
      header: "Result",
      width: "100px",
      render: (x) => {
        const r = describeResult(x.status);
        return <Tag tone={r.ok ? "success" : "destructive"}>{r.label}</Tag>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        description={summary.length ? `This IAM has ${summary.join(", ")}.` : undefined}
      />

      <section className="mb-10">
        <h2 className="mb-3 text-[15px] font-semibold">Needs attention</h2>
        {loading ? (
          <div className="h-24 animate-pulse rounded-lg bg-[var(--muted)]" />
        ) : items.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-4 text-[14px] text-[var(--muted-foreground)]">
            <CircleCheck className="size-4 text-[var(--success)]" aria-hidden="true" />
            Nothing right now.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
            {items.map((it) => (
              <li key={it.key}>
                <Link
                  to={it.to}
                  className="group flex items-center gap-3 px-4 py-3 text-[14px] hover:bg-[var(--muted)]/60"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${DOT[it.tone]}`}
                  />
                  <span className="flex-1">{it.text}</span>
                  <span className="flex items-center gap-1 text-[13px] text-[var(--primary)]">
                    {it.cta}
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {can("platform.audit.read") ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Latest changes</h2>
            <Link to="/admin/audit" className="text-[13px] text-[var(--primary)] hover:underline">
              Full audit log
            </Link>
          </div>
          <DataTable
            columns={columns}
            rows={actions.data?.content.slice(0, 6)}
            loading={actions.isLoading}
            empty="Nothing has been changed through the admin API yet."
            rowKey={(x) => x.id}
          />
        </section>
      ) : null}
    </div>
  );
}
