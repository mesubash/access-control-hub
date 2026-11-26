import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { policiesApi } from "@/api/resources";
import type { Policy } from "@/api/types";
import { PageHeader } from "@/components/iam/PageHeader";
import { PermissionGuardedPage } from "@/components/iam/PermissionGuardedPage";
import { Can } from "@/components/iam/Can";
import { DataTable, type Column } from "@/components/iam/DataTable";
import { EnforcementBadge, Tag } from "@/components/iam/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/iam/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/admin/policies")({
  head: () => ({ meta: [{ title: pageTitle("Policies") }] }),
  component: () => (
    <PermissionGuardedPage permission="platform.policy.read">
      <PoliciesPage />
    </PermissionGuardedPage>
  ),
});

function PoliciesPage() {
  const q = useQuery({ queryKey: ["policies"], queryFn: policiesApi.list });
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Policy | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Policy | null>(null);

  const del = useMutation({
    mutationFn: () => policiesApi.deactivate(toDelete!.id),
    onSuccess: () => {
      toast.success("Policy turned off");
      qc.invalidateQueries({ queryKey: ["policies"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<Policy>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <span className={p.active === false ? "text-[var(--muted-foreground)]" : undefined}>
          {p.name} {p.active === false ? <Tag>Off</Tag> : null}
        </span>
      ),
    },
    {
      key: "effect",
      header: "Effect",
      width: "90px",
      render: (p) => (
        <Tag tone={p.effect === "DENY" ? "destructive" : "success"}>
          {p.effect === "DENY" ? "Deny" : "Allow"}
        </Tag>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      width: "100px",
      render: (p) => <EnforcementBadge mode={p.enforcementMode} />,
    },
    { key: "pri", header: "Priority", width: "80px", render: (p) => p.priority },
    {
      key: "perm",
      header: "Permission",
      render: (p) => <span className="font-mono text-xs">{p.permissionKey}</span>,
    },
    { key: "rt", header: "Resource type", render: (p) => p.resourceType ?? "—" },
  ];

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Rules on attributes like time, amount or location, checked after roles. Try them in shadow mode first."
        actions={
          <Can permission="platform.policy.create">
            <Button onClick={() => setCreating(true)}>New policy</Button>
          </Can>
        }
      />
      <DataTable
        columns={columns}
        rows={q.data}
        loading={q.isLoading}
        empty="No policies."
        rowKey={(p) => p.id}
        onRowClick={setEditing}
      />
      {creating ? <PolicyDialog open onOpenChange={setCreating} /> : null}
      {editing ? (
        <PolicyDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          policy={editing}
          onDelete={() => {
            setToDelete(editing);
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Turn off this policy?"
        description="It stops being checked straight away. You can turn it back on later."
        target={toDelete?.name}
        destructive
        confirmLabel="Turn off"
        pending={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}

const OPERATOR_HELP =
  "Operators: eq, neq, in, not_in, contains, exists, gt, gte, lt, lte, regex, before, after. Fields: subject.*, permission, resource.*, context.*";

function PolicyDialog({
  open,
  onOpenChange,
  policy,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  policy?: Policy;
  onDelete?: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(policy?.name ?? "");
  const [effect, setEffect] = useState<string>(policy?.effect ?? "ALLOW");
  const [enforcementMode, setEnforcementMode] = useState<"ENFORCE" | "SHADOW">(
    policy?.enforcementMode ?? "SHADOW",
  );
  const [priority, setPriority] = useState<number>(policy?.priority ?? 100);
  const [permissionKey, setPermissionKey] = useState(policy?.permissionKey ?? "");
  const [resourceType, setResourceType] = useState(policy?.resourceType ?? "");
  const [conditions, setConditions] = useState<string>(
    policy?.conditions ? JSON.stringify(policy.conditions, null, 2) : "{}",
  );
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const [showRef, setShowRef] = useState(false);
  const [confirmEnforce, setConfirmEnforce] = useState(false);
  // Moving to ENFORCE changes live decisions, so it gets its own confirmation.
  const startsEnforcing =
    enforcementMode === "ENFORCE" && (!policy || policy.enforcementMode !== "ENFORCE");

  const turnOn = useMutation({
    mutationFn: () => policiesApi.update(policy!.id, { active: true }),
    onSuccess: () => {
      toast.success("Policy turned back on");
      void qc.invalidateQueries({ queryKey: ["policies"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const validateJson = (v: string) => {
    try {
      JSON.parse(v);
      setJsonErr(null);
      return true;
    } catch (e) {
      setJsonErr((e as Error).message);
      return false;
    }
  };

  const save = useMutation({
    mutationFn: () => {
      if (!validateJson(conditions)) throw new Error("Fix JSON errors first.");
      const body: Partial<Policy> = {
        name,
        effect,
        enforcementMode,
        priority,
        permissionKey,
        resourceType: resourceType || undefined,
        conditions: JSON.parse(conditions),
      };
      return policy ? policiesApi.update(policy.id, body) : policiesApi.create(body);
    },
    onSuccess: () => {
      toast.success(policy ? "Policy saved" : "Policy created");
      setConfirmEnforce(false);
      qc.invalidateQueries({ queryKey: ["policies"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{policy ? policy.name : "New policy"}</DialogTitle>
          <DialogDescription>
            {policy
              ? "A policy's name is fixed once created; everything else can change."
              : "Checked after roles. Start in shadow mode to see what it would do before it blocks anyone."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {policy ? null : (
              <>
                <Label htmlFor="p-name">Name</Label>
                <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
              </>
            )}
            <Label htmlFor="p-effect">Effect</Label>
            <select
              id="p-effect"
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
              className="h-9 w-full rounded-md border border-[var(--input)] bg-[var(--card)] px-2 text-sm"
            >
              <option value="ALLOW">Allow when the conditions match</option>
              <option value="DENY">Deny when the conditions match</option>
            </select>
            <Label htmlFor="p-mode">Mode</Label>
            <select
              id="p-mode"
              value={enforcementMode}
              onChange={(e) => setEnforcementMode(e.target.value as "ENFORCE" | "SHADOW")}
              className="h-9 w-full rounded-md border border-[var(--input)] bg-[var(--card)] px-2 text-sm"
            >
              <option value="SHADOW">Shadow: log what it would do</option>
              <option value="ENFORCE">Enforce: affects real decisions</option>
            </select>
            <Label htmlFor="p-pri">Priority</Label>
            <Input
              id="p-pri"
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
            <Label htmlFor="p-perm">Applies to permission</Label>
            <Input
              id="p-perm"
              className="font-mono"
              spellCheck={false}
              placeholder="orders.order.refund"
              value={permissionKey}
              onChange={(e) => setPermissionKey(e.target.value)}
            />
            <Label htmlFor="p-rt">Resource type (optional)</Label>
            <Input
              id="p-rt"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-cond">Conditions (JSON)</Label>
            <textarea
              id="p-cond"
              value={conditions}
              onChange={(e) => {
                setConditions(e.target.value);
                validateJson(e.target.value);
              }}
              rows={14}
              spellCheck={false}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] p-2 font-mono text-xs"
            />
            {jsonErr ? <p className="text-xs text-[var(--destructive)]">{jsonErr}</p> : null}
            <button
              type="button"
              onClick={() => setShowRef((v) => !v)}
              className="text-xs text-[var(--primary)] hover:underline"
            >
              {showRef ? "Hide" : "Show"} operator reference
            </button>
            {showRef ? (
              <p className="rounded border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-[11px] text-[var(--muted-foreground)]">
                {OPERATOR_HELP}
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          {policy && onDelete && policy.active !== false ? (
            <Button
              variant="outline"
              className="sm:mr-auto"
              style={{ color: "var(--destructive)" }}
              onClick={onDelete}
            >
              Turn off
            </Button>
          ) : null}
          {policy && policy.active === false ? (
            <Button variant="outline" className="sm:mr-auto" onClick={() => turnOn.mutate()}>
              Turn back on
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => (startsEnforcing ? setConfirmEnforce(true) : save.mutate())}
            disabled={save.isPending || !name || !permissionKey || !!jsonErr}
          >
            {save.isPending ? "Saving…" : policy ? "Save changes" : "Create policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={confirmEnforce}
        onOpenChange={setConfirmEnforce}
        title="Start enforcing this policy?"
        description={`From now on it can ${effect === "DENY" ? "block" : "allow"} real requests for ${permissionKey || "this permission"}. Check the audit log for what it did in shadow mode first.`}
        confirmLabel="Enforce"
        destructive={effect === "DENY"}
        pending={save.isPending}
        onConfirm={() => save.mutate()}
      />
    </Dialog>
  );
}
