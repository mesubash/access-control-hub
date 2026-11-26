import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Plus } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { identitiesApi } from "@/api/resources";
import type { IdentityAdmin } from "@/api/types";
import { ConfirmDialog } from "@/components/iam/ConfirmDialog";
import { DataTable, type Column } from "@/components/iam/DataTable";
import { StatusBadge, Tag } from "@/components/iam/badges";
import { When } from "@/components/iam/When";
import { PageHeader } from "@/components/iam/PageHeader";
import { PermissionGuardedPage } from "@/components/iam/PermissionGuardedPage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthz } from "@/context/AuthzContext";
import { pageTitle } from "@/lib/brand";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: pageTitle("Users") }] }),
  component: () => (
    <PermissionGuardedPage permission="platform.identity.read">
      <UsersPage />
    </PermissionGuardedPage>
  ),
});

const STATUSES = ["ACTIVE", "LOCKED", "SUSPENDED", "DEACTIVATED"] as const;

function UsersPage() {
  const { can } = useAuthz();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [selected, setSelected] = useState<IdentityAdmin | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["identities", deferredQuery, status],
    queryFn: () => identitiesApi.list({ query: deferredQuery, status }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<IdentityAdmin>[] = [
    {
      key: "who",
      header: "User",
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{u.displayName || u.email}</p>
          {u.displayName ? (
            <p className="truncate text-[12.5px] text-[var(--muted-foreground)]">{u.email}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "s",
      header: "Status",
      width: "120px",
      render: (u) => <StatusBadge status={u.accountStatus} />,
    },
    {
      key: "sec",
      header: "Sign-in",
      width: "200px",
      render: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.mfaEnabled ? <Tag tone="success">Two-step on</Tag> : <Tag>Password only</Tag>}
          {u.emailVerified ? null : <Tag tone="warning">Email unverified</Tag>}
        </span>
      ),
    },
    {
      key: "last",
      header: "Last sign-in",
      width: "140px",
      render: (u) =>
        u.lastLoginAt ? (
          <When at={u.lastLoginAt} />
        ) : (
          <span className="text-[var(--muted-foreground)]">Never</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Everyone with an account. Suspend access, reset a password or two-step verification, and see who signs in."
        actions={
          can("platform.identity.create") ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Add user
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          aria-label="Search users"
          placeholder="Search by email or name"
          className="max-w-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-[var(--input)] bg-[var(--card)] px-2 text-[13px]"
        >
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        columns={columns}
        rows={q.data}
        loading={q.isLoading}
        empty={deferredQuery || status ? "No users match." : "No users yet."}
        rowKey={(u) => u.id}
        onRowClick={setSelected}
      />
      {selected ? (
        <UserDialog user={selected} onClose={() => setSelected(null)} onChange={setSelected} />
      ) : null}
      <CreateUserDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

type Pending = null | "suspend" | "reactivate" | "password" | "mfa";

function UserDialog({
  user,
  onClose,
  onChange,
}: {
  user: IdentityAdmin;
  onClose: () => void;
  onChange: (u: IdentityAdmin) => void;
}) {
  const qc = useQueryClient();
  const { can } = useAuthz();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const done = (msg: string) => {
    toast.success(msg);
    setConfirm(null);
    setReason("");
    void qc.invalidateQueries({ queryKey: ["identities"] });
  };

  const act = useMutation({
    mutationFn: async (what: Exclude<Pending, null>) => {
      switch (what) {
        case "suspend":
          onChange(await identitiesApi.setStatus(user.id, "SUSPENDED", reason));
          return done("User suspended");
        case "reactivate":
          onChange(await identitiesApi.setStatus(user.id, "ACTIVE", reason || "Reactivated"));
          return done("User reactivated");
        case "password": {
          const r = await identitiesApi.resetPassword(user.id);
          setTempPassword(r.temporaryPassword ?? null);
          return done("Password reset; their sessions were signed out");
        }
        case "mfa":
          await identitiesApi.resetMfa(user.id);
          onChange({ ...user, mfaEnabled: false });
          return done("Two-step verification reset");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: () => identitiesApi.markEmailVerified(user.id),
    onSuccess: (u) => {
      onChange(u);
      done("Email marked as verified");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canUpdate = can("platform.identity.update");
  const canSuspend = can("platform.identity.suspend");
  const active = user.accountStatus === "ACTIVE";

  const rows: [string, React.ReactNode][] = [
    ["Status", <StatusBadge key="s" status={user.accountStatus} />],
    [
      "User ID",
      <code key="i" className="font-mono text-[12.5px] break-all">
        {user.id}
      </code>,
    ],
    [
      "Email",
      <>
        {user.email} {user.emailVerified ? null : <Tag tone="warning">Unverified</Tag>}
      </>,
    ],
    ["Two-step", user.mfaEnabled ? "On" : "Off"],
    [
      "Last sign-in",
      user.lastLoginAt
        ? `${formatDate(user.lastLoginAt)}${user.lastLoginIp ? ` from ${user.lastLoginIp}` : ""}`
        : "Never",
    ],
    ["Failed attempts", String(user.failedLoginAttempts ?? 0)],
    ["Created", formatDate(user.createdAt)],
  ];

  const confirmCopy: Record<
    Exclude<Pending, null>,
    { title: string; body: string; label: string; destructive?: boolean }
  > = {
    suspend: {
      title: "Suspend this user?",
      body: "They're signed out and can't sign in until reactivated. Their roles stay in place.",
      label: "Suspend user",
      destructive: true,
    },
    reactivate: {
      title: "Reactivate this user?",
      body: "They can sign in again with their existing password.",
      label: "Reactivate",
    },
    password: {
      title: "Reset their password?",
      body: "A temporary password is generated and every session they have is signed out.",
      label: "Reset password",
      destructive: true,
    },
    mfa: {
      title: "Reset two-step verification?",
      body: "Their authenticator and recovery codes stop working. They set it up again at next sign-in if their role requires it.",
      label: "Reset two-step",
      destructive: true,
    },
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{user.displayName || user.email}</DialogTitle>
            {user.displayName ? <DialogDescription>{user.email}</DialogDescription> : null}
          </DialogHeader>
          <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-[13.5px]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[var(--muted-foreground)]">{k}</dt>
                <dd className="min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
          {tempPassword ? <TempPassword value={tempPassword} /> : null}
          {canUpdate || canSuspend ? (
            <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
              {canSuspend ? (
                active ? (
                  <Button variant="outline" onClick={() => setConfirm("suspend")}>
                    Suspend
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setConfirm("reactivate")}>
                    {user.accountStatus === "LOCKED" ? "Unlock" : "Reactivate"}
                  </Button>
                )
              ) : null}
              {canUpdate ? (
                <>
                  <Button variant="outline" onClick={() => setConfirm("password")}>
                    Reset password
                  </Button>
                  {user.mfaEnabled ? (
                    <Button variant="outline" onClick={() => setConfirm("mfa")}>
                      Reset two-step
                    </Button>
                  ) : null}
                  {user.emailVerified ? null : (
                    <Button
                      variant="outline"
                      onClick={() => verify.mutate()}
                      disabled={verify.isPending}
                    >
                      Mark email verified
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {confirm ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={confirmCopy[confirm].title}
          description={confirmCopy[confirm].body}
          target={user.email}
          confirmLabel={confirmCopy[confirm].label}
          destructive={confirmCopy[confirm].destructive}
          pending={act.isPending}
          onConfirm={() => act.mutate(confirm)}
        >
          {confirm === "suspend" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="reason">Reason (kept in the audit log)</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </>
  );
}

function TempPassword({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-[13px]">
      <p className="mb-1.5 text-[var(--muted-foreground)]">
        Temporary password. Shown once: pass it on securely.
      </p>
      <div className="flex items-center justify-between gap-2">
        <code className="font-mono text-[14px] break-all">{value}</code>
        <button
          type="button"
          aria-label="Copy temporary password"
          className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-[var(--card)]"
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(true);
  const [temp, setTemp] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => identitiesApi.create({ email: email.trim(), emailVerified: verified }),
    onSuccess: (r) => {
      toast.success("User added");
      setTemp(r.temporaryPassword ?? null);
      void qc.invalidateQueries({ queryKey: ["identities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = (o: boolean) => {
    if (!o) {
      setEmail("");
      setTemp(null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a user</DialogTitle>
          <DialogDescription>
            They get a temporary password to sign in with. Give them roles on the Assignments page.
          </DialogDescription>
        </DialogHeader>
        {temp ? (
          <TempPassword value={temp} />
        ) : (
          <form
            id="create-user"
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-[13.5px]">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Treat the email as already verified
            </label>
          </form>
        )}
        <DialogFooter>
          {temp ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" form="create-user" disabled={m.isPending || !email.trim()}>
                {m.isPending ? "Adding…" : "Add user"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
