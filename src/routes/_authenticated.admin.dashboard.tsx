import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { assignmentsApi, auditApi, policiesApi, rolesApi, scopesApi } from "@/api/resources";
import type { AdminAction } from "@/api/types";
import { DataTable, type Column } from "@/components/iam/DataTable";
import { Tag } from "@/components/iam/badges";
import { When } from "@/components/iam/When";
import { PageHeader } from "@/components/iam/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { useAuthz } from "@/context/AuthzContext";
import { pageTitle } from "@/lib/brand";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({ meta: [{ title: pageTitle("Overview") }] }),
  component: DashboardPage,
});

function Stat({
  label,
  value,
  to,
  loading,
}: {
  label: string;
  value?: number;
  to: string;
  loading: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3.5 transition-colors hover:border-[var(--input)]"
    >
      <p className="flex items-center justify-between text-[13px] text-[var(--muted-foreground)]">
        {label}
        <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </p>
      <p className="mt-1 text-[26px] leading-tight font-semibold tracking-tight tabular-nums">
        {loading ? (
          <span className="inline-block h-6 w-10 animate-pulse rounded bg-[var(--muted)]" />
        ) : (
          (value ?? "—")
        )}
      </p>
    </Link>
  );
}

function DashboardPage() {
  const { identity } = useAuth();
  const { can } = useAuthz();

  const scopes = useQuery({
    queryKey: ["scopes"],
    queryFn: scopesApi.list,
    enabled: can("platform.scope.read"),
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: rolesApi.list,
    enabled: can("platform.role.read"),
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
  const actions = useQuery({
    queryKey: ["audit", "admin", 0],
    queryFn: () => auditApi.adminActions(0),
    enabled: can("platform.audit.read"),
  });

  const columns: Column<AdminAction>[] = [
    { key: "t", header: "When", width: "130px", render: (a) => <When at={a.createdAt} /> },
    { key: "who", header: "Who", render: (a) => a.actorEmail ?? "—" },
    {
      key: "what",
      header: "Request",
      render: (a) => (
        <span className="block max-w-[46ch] truncate font-mono text-[12.5px]" title={a.path}>
          {a.method} {a.path}
        </span>
      ),
    },
    {
      key: "s",
      header: "Result",
      width: "90px",
      render: (a) => <Tag tone={a.status < 400 ? "success" : "destructive"}>{a.status}</Tag>,
    },
  ];

  const first = identity?.displayName?.split(" ")[0];

  return (
    <div>
      <PageHeader
        title={first ? `Hello, ${first}` : "Overview"}
        description="What's set up in this IAM, and the latest changes made through it."
      />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Scopes"
          to="/admin/scopes"
          value={scopes.data?.length}
          loading={scopes.isLoading}
        />
        <Stat
          label="Roles"
          to="/admin/roles"
          value={roles.data?.length}
          loading={roles.isLoading}
        />
        <Stat
          label="Assignments"
          to="/admin/assignments"
          value={assignments.data?.filter((a) => a.active !== false).length}
          loading={assignments.isLoading}
        />
        <Stat
          label="Policies"
          to="/admin/policies"
          value={policies.data?.filter((p) => p.active !== false).length}
          loading={policies.isLoading}
        />
      </div>
      {can("platform.audit.read") ? (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">Latest changes</h2>
            <Link to="/admin/audit" className="text-[13px] text-[var(--primary)] hover:underline">
              Full audit log
            </Link>
          </div>
          <DataTable
            columns={columns}
            rows={actions.data?.content.slice(0, 8)}
            loading={actions.isLoading}
            empty="Nothing has been changed through the admin API yet."
            rowKey={(a) => a.id}
          />
        </>
      ) : null}
    </div>
  );
}
