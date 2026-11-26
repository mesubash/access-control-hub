import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { auditApi } from "@/api/resources";
import type { AdminAction, AuditEntry, SecurityEvent } from "@/api/types";
import { DataTable, type Column } from "@/components/iam/DataTable";
import { DecisionBadge, Tag } from "@/components/iam/badges";
import { When } from "@/components/iam/When";
import { Subject } from "@/components/iam/Subject";
import { PageHeader } from "@/components/iam/PageHeader";
import { PermissionGuardedPage } from "@/components/iam/PermissionGuardedPage";
import { Pager } from "@/components/iam/Pager";
import { Tabs } from "@/components/iam/Tabs";
import { Input } from "@/components/ui/input";
import { pageTitle } from "@/lib/brand";
import { formatDate, humanize } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: pageTitle("Audit log") }] }),
  component: () => (
    <PermissionGuardedPage permission="platform.audit.read">
      <AuditPage />
    </PermissionGuardedPage>
  ),
});

type View = "admin" | "security" | "decisions";

function AuditPage() {
  const [view, setView] = useState<View>("admin");
  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Who changed what, sign-in and account events, and every access decision for a user."
      />
      <Tabs
        label="Audit views"
        value={view}
        onChange={setView}
        options={[
          { value: "admin", label: "Admin actions" },
          { value: "security", label: "Security events" },
          { value: "decisions", label: "Decisions for a user" },
        ]}
      />
      {view === "admin" ? <AdminActions /> : null}
      {view === "security" ? <SecurityEvents /> : null}
      {view === "decisions" ? <Decisions /> : null}
    </div>
  );
}

const methodTone = (m: string) =>
  m === "DELETE" ? "destructive" : m === "GET" ? "neutral" : ("accent" as const);

function AdminActions() {
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["audit", "admin", page],
    queryFn: () => auditApi.adminActions(page),
  });
  const columns: Column<AdminAction>[] = [
    { key: "t", header: "When", width: "130px", render: (a) => <When at={a.createdAt} /> },
    { key: "who", header: "Who", render: (a) => a.actorEmail ?? a.actorId ?? "—" },
    {
      key: "what",
      header: "Request",
      render: (a) => (
        <span className="flex items-center gap-2">
          <Tag tone={methodTone(a.method)} mono>
            {a.method}
          </Tag>
          <span className="max-w-[46ch] truncate font-mono text-[12.5px]" title={a.path}>
            {a.path}
          </span>
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
  return (
    <>
      <DataTable
        columns={columns}
        rows={q.data?.content}
        loading={q.isLoading}
        empty="No admin actions recorded yet."
        rowKey={(a) => a.id}
      />
      <Pager page={q.data} onPage={setPage} />
    </>
  );
}

function SecurityEvents() {
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["audit", "security", page],
    queryFn: () => auditApi.securityEvents(page),
  });
  const bad = /FAILED|LOCKED|SUSPENDED|EVICTED|REVOKED/;
  const columns: Column<SecurityEvent>[] = [
    { key: "t", header: "When", width: "130px", render: (e) => <When at={e.createdAt} /> },
    {
      key: "e",
      header: "Event",
      render: (e) => (
        <Tag tone={bad.test(e.eventType) ? "warning" : "neutral"}>{humanize(e.eventType)}</Tag>
      ),
    },
    {
      key: "who",
      header: "User",
      render: (e) => <Subject id={e.identityId} />,
    },
    { key: "ip", header: "IP address", render: (e) => e.ipAddress ?? "—" },
  ];
  return (
    <>
      <DataTable
        columns={columns}
        rows={q.data?.content}
        loading={q.isLoading}
        empty="No security events yet."
        rowKey={(e) => e.id}
      />
      <Pager page={q.data} onPage={setPage} />
    </>
  );
}

function Decisions() {
  const [draft, setDraft] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const q = useQuery({
    queryKey: ["audit", "subject", subjectId],
    queryFn: () => auditApi.bySubject(subjectId),
    enabled: !!subjectId,
  });
  const columns: Column<AuditEntry>[] = [
    { key: "t", header: "When", width: "130px", render: (e) => <When at={e.timestamp} /> },
    {
      key: "p",
      header: "Permission",
      render: (e) => <span className="font-mono text-[12.5px]">{e.permissionKey}</span>,
    },
    {
      key: "r",
      header: "Resource",
      render: (e) => (e.resourceType ? `${e.resourceType} ${e.resourceId ?? ""}` : "—"),
    },
    {
      key: "d",
      header: "Decision",
      width: "100px",
      render: (e) => <DecisionBadge allowed={e.decision} />,
    },
    { key: "why", header: "Reason", render: (e) => e.reason ?? "—" },
  ];
  return (
    <>
      <form
        className="mb-4 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubjectId(draft.trim());
        }}
      >
        <Input
          aria-label="User ID"
          placeholder="User ID (UUID)"
          className="font-mono"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-md bg-[var(--primary)] px-4 text-[13px] font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
        >
          Show decisions
        </button>
      </form>
      {subjectId ? (
        <DataTable
          columns={columns}
          rows={q.data}
          loading={q.isLoading}
          empty="No decisions recorded for this user."
          rowKey={(e) => e.id}
        />
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">
          Enter a user ID to see every allow and deny decision made for them. Find IDs on the Users
          page.
        </p>
      )}
    </>
  );
}
