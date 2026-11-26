import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { authApi } from "@/api/resources";
import { PageHeader } from "@/components/iam/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/api/client";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/me/security")({
  head: () => ({ meta: [{ title: pageTitle("Security") }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: () => {
      toast.success("Password changed. Other devices stay signed in until you sign them out.");
      setCurrent("");
      setNext("");
      setConfirm("");
      setErr(null);
    },
    onError: (e: Error) => setErr(e instanceof ApiError ? e.message : "Could not change password."),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (next.length < 8) return setErr("New password must be at least 8 characters.");
    if (next !== confirm) return setErr("Passwords do not match.");
    m.mutate();
  };

  return (
    <div>
      <PageHeader title="Security" description="Change your password." />
      <form
        onSubmit={onSubmit}
        className="max-w-md space-y-4 rounded border border-[var(--border)] bg-[var(--card)] p-4"
      >
        <h2 className="text-sm font-semibold">Change password</h2>
        <div className="space-y-1.5">
          <Label htmlFor="cur">Current password</Label>
          <Input
            id="cur"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new">New password</Label>
          <Input
            id="new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conf">Confirm new password</Label>
          <Input
            id="conf"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {err ? <p className="text-sm text-[var(--destructive)]">{err}</p> : null}
        <Button type="submit" disabled={m.isPending}>
          {m.isPending ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
