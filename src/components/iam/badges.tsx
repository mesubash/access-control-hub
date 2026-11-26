import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "success" | "warning" | "destructive";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  accent: "bg-[var(--primary-subtle)] text-[var(--primary)]",
  success: "bg-[var(--success-subtle)] text-[var(--success)]",
  warning: "bg-[var(--warning-subtle)] text-[var(--warning)]",
  destructive: "bg-[var(--destructive-subtle)] text-[var(--destructive)]",
};

export function Tag({
  tone = "neutral",
  children,
  className,
  mono = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[12px] font-medium whitespace-nowrap",
        mono && "font-mono",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** spring-iam records a decision as a boolean: true = allowed. */
export function DecisionBadge({ allowed }: { allowed: boolean }) {
  return <Tag tone={allowed ? "success" : "destructive"}>{allowed ? "Allowed" : "Denied"}</Tag>;
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  LOCKED: "warning",
  SUSPENDED: "warning",
  DEACTIVATED: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return <Tag tone={STATUS_TONE[status] ?? "neutral"}>{label}</Tag>;
}

export function EnforcementBadge({ mode }: { mode: "ENFORCE" | "SHADOW" }) {
  return (
    <Tag tone={mode === "SHADOW" ? "warning" : "neutral"}>
      {mode === "SHADOW" ? "Shadow" : "Enforced"}
    </Tag>
  );
}
