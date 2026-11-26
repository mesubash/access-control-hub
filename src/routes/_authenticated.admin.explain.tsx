import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { authzApi, permissionsApi, scopesApi } from "@/api/resources";
import type { ExplainResult, ExplainStep } from "@/api/types";
import { DecisionBadge } from "@/components/iam/badges";
import { UserPicker } from "@/components/iam/Subject";
import { PageHeader } from "@/components/iam/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthz } from "@/context/AuthzContext";
import { pageTitle } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/explain")({
  head: () => ({ meta: [{ title: pageTitle("Explain a decision") }] }),
  component: ExplainPage,
});

// spring-iam's decision pipeline, in the order it runs.
const STAGES: Record<string, { label: string; what: string }> = {
  deny_rules: { label: "Deny rules", what: "An explicit deny always wins." },
  rbac_scope: {
    label: "Roles in scope",
    what: "Does a role assigned in this scope, or above it, grant the permission?",
  },
  conditions: {
    label: "Assignment conditions",
    what: "Conditions attached to the assignment, such as time or IP.",
  },
  resource_grants: { label: "Resource grants", what: "A grant on this exact resource." },
  policies: { label: "Policies", what: "ABAC policies that can still allow or deny." },
};

const TONE: Record<ExplainStep["outcome"], string> = {
  PASS: "success",
  ALLOW: "success",
  FAIL: "destructive",
  DENY: "destructive",
  SKIP: "neutral",
};

function ExplainPage() {
  const { scopeId: currentScope } = useAuthz();
  const scopes = useQuery({ queryKey: ["scopes"], queryFn: scopesApi.list, retry: false });
  const [subject, setSubject] = useState("");
  const [permission, setPermission] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [result, setResult] = useState<ExplainResult | null>(null);

  const scope = scopeId || currentScope || "";

  const m = useMutation({
    mutationFn: () =>
      authzApi.explain({
        subject: subject.trim(),
        permission: permission.trim(),
        resource: {
          scopeId: scope,
          type: resourceType.trim() || undefined,
          id: resourceId.trim() || undefined,
        },
      }),
    onSuccess: setResult,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Explain a decision"
        description="Ask whether a user can do something, and see each step spring-iam takes to decide. Nothing is recorded."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="grid min-w-0 gap-3.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
        >
          <Field label="User" id="x-subject">
            <UserPicker id="x-subject" value={subject} onChange={setSubject} />
          </Field>
          <PermissionPicker value={permission} onChange={setPermission} />
          <Field label="Scope" id="x-scope">
            {scopes.data ? (
              <select
                id="x-scope"
                value={scope}
                onChange={(e) => setScopeId(e.target.value)}
                className="h-9 w-full min-w-0 rounded-md border border-[var(--input)] bg-[var(--card)] px-2 text-[13px]"
              >
                {scopes.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.path}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="x-scope"
                className="font-mono"
                placeholder="Scope ID"
                value={scope}
                onChange={(e) => setScopeId(e.target.value)}
                required
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Resource type" id="x-rt">
              <Input
                id="x-rt"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
              />
            </Field>
            <Field label="Resource ID" id="x-ri">
              <Input id="x-ri" value={resourceId} onChange={(e) => setResourceId(e.target.value)} />
            </Field>
          </div>
          <p className="-mt-1.5 text-[12.5px] text-[var(--muted-foreground)]">
            Both optional: fill them to check one specific record.
          </p>
          <Button
            type="submit"
            disabled={m.isPending || !subject.trim() || !permission.trim() || !scope}
          >
            {m.isPending ? "Checking…" : "Explain"}
          </Button>
        </form>

        <section
          aria-live="polite"
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
        >
          {!result ? (
            <div className="text-[13.5px] text-[var(--muted-foreground)]">
              <p className="mb-3">The checks run in this order:</p>
              <ol className="grid gap-2">
                {Object.entries(STAGES).map(([k, s], i) => (
                  <li key={k} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-[12px] font-semibold">
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-medium text-[var(--foreground)]">{s.label}.</span>{" "}
                      {s.what}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <DecisionBadge allowed={result.allowed} />
                <p className="text-[14px]">{result.reason}</p>
              </div>
              <ol className="relative grid gap-3 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-px before:bg-[var(--border)]">
                {result.steps.map((step, i) => {
                  const tone = TONE[step.outcome] ?? "neutral";
                  const stage = STAGES[step.name];
                  return (
                    <li key={i} className="relative flex gap-3">
                      <span
                        className={cn(
                          "z-10 grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ring-4 ring-[var(--card)]",
                          tone === "success" && "bg-[var(--success-subtle)] text-[var(--success)]",
                          tone === "destructive" &&
                            "bg-[var(--destructive-subtle)] text-[var(--destructive)]",
                          tone === "neutral" && "bg-[var(--muted)] text-[var(--muted-foreground)]",
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[14px] font-medium">
                          {stage?.label ?? step.name}{" "}
                          <span
                            className={cn(
                              "ml-1 text-[12.5px] font-medium",
                              tone === "success" && "text-[var(--success)]",
                              tone === "destructive" && "text-[var(--destructive)]",
                              tone === "neutral" && "text-[var(--muted-foreground)]",
                            )}
                          >
                            {step.outcome === "SKIP" ? "skipped" : step.outcome.toLowerCase()}
                          </span>
                        </p>
                        {step.detail ? (
                          <p className="mt-0.5 text-[13px] text-pretty text-[var(--muted-foreground)]">
                            {step.detail}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id}>
        {label}{" "}
        {hint ? <span className="font-normal text-[var(--muted-foreground)]">({hint})</span> : null}
      </Label>
      {children}
    </div>
  );
}

/** Free text with suggestions from the permission catalogue, when it can be read. */
function PermissionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const perms = useQuery({ queryKey: ["permissions"], queryFn: permissionsApi.list, retry: false });
  return (
    <Field label="Permission" id="x-perm">
      <Input
        id="x-perm"
        className="font-mono"
        placeholder="orders.order.read"
        list="x-perm-list"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      <datalist id="x-perm-list">
        {(perms.data ?? []).map((p) => (
          <option key={p.id} value={p.key} />
        ))}
      </datalist>
    </Field>
  );
}
