import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { ApiError } from "@/api/client";
import { BadgeMark } from "@/components/iam/BadgeMark";
import { ThemeToggle } from "@/components/iam/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { APP_NAME, pageTitle } from "@/lib/brand";
import { DEMO } from "@/lib/demoFlag";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: pageTitle("Sign in") }] }),
  component: LoginPage,
});

type Step = { kind: "password" } | { kind: "mfa"; challenge: string } | { kind: "enroll" };

function LoginPage() {
  const { login, verifyMfa, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [reveal, setReveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) void navigate({ to: "/admin/dashboard" });
  }, [isAuthenticated, navigate]);

  const run = async (
    e: FormEvent | undefined,
    fn: () => Promise<Awaited<ReturnType<typeof login>>>,
  ) => {
    e?.preventDefault();
    setError(null);
    setPending(true);
    try {
      const next = await fn();
      if (next.next === "mfa") setStep({ kind: "mfa", challenge: next.challenge });
      else if (next.next === "enroll") setStep({ kind: "enroll" });
      // "done": the effect above navigates once the identity is set.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  };

  const restart = () => {
    setStep({ kind: "password" });
    setCode("");
    setError(null);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <BadgeMark className="size-5 text-[var(--primary)]" />
          {APP_NAME}
        </span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 justify-center px-4 pt-6 pb-16 sm:pt-[min(10vh,96px)]">
        <div className="w-full max-w-[400px]">
          <div className="badge-shadow">
            <div className="badge overflow-hidden rounded-[18px] bg-[var(--card)]">
              <div
                aria-hidden="true"
                className={cn(
                  "h-12 transition-colors duration-500 motion-reduce:transition-none",
                  step.kind === "enroll"
                    ? "bg-[var(--warning-subtle)]"
                    : "bg-[var(--primary-subtle)]",
                )}
              />
              <div className="px-6 pt-7 pb-7 sm:px-8 sm:pb-8">
                {step.kind === "password" ? (
                  <Panel
                    title="Sign in to the console"
                    subtitle="Manage who can do what across your apps. For administrators and auditors."
                  >
                    {DEMO ? (
                      <DemoAccounts
                        pending={pending}
                        onPick={(demoEmail) => run(undefined, () => login(demoEmail, "demo"))}
                      />
                    ) : null}
                    <form
                      onSubmit={(e) => run(e, () => login(email.trim(), password))}
                      className="grid gap-4"
                    >
                      <ErrorLine message={error} />
                      <div className="grid gap-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          autoComplete="username"
                          autoFocus
                          required
                          className="h-11"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={reveal ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            className="h-11 pr-11"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setReveal((v) => !v)}
                            aria-label={reveal ? "Hide password" : "Show password"}
                            aria-pressed={reveal}
                            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                          >
                            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                      <Submit pending={pending}>Sign in</Submit>
                    </form>
                  </Panel>
                ) : null}

                {step.kind === "mfa" ? (
                  <Panel
                    title="Confirm it's you"
                    subtitle="Enter the 6-digit code from your authenticator app, or a recovery code."
                  >
                    <form
                      onSubmit={(e) => run(e, () => verifyMfa(step.challenge, code.trim()))}
                      className="grid gap-4"
                    >
                      <ErrorLine message={error} />
                      <div className="grid gap-1.5">
                        <Label htmlFor="code">Verification code</Label>
                        <Input
                          id="code"
                          autoComplete="one-time-code"
                          autoFocus
                          required
                          className="h-11 text-center font-mono text-lg tracking-[0.3em]"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                        />
                      </div>
                      <Submit pending={pending}>Verify</Submit>
                      <BackLink onClick={restart} />
                    </form>
                  </Panel>
                ) : null}

                {step.kind === "enroll" ? (
                  <Panel
                    title="Set up two-step verification first"
                    subtitle="Your role requires a code from your phone at sign-in. Set it up on your organisation's sign-in page, then come back here."
                  >
                    <BackLink onClick={restart} />
                  </Panel>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <>
      <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-[15px] leading-relaxed text-pretty text-[var(--muted-foreground)]">
          {subtitle}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="empty:hidden">
      {message ? (
        <p className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive-subtle)] px-3 py-2 text-[13.5px] text-[var(--destructive)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button
      type="submit"
      className="h-11 w-full text-[15px]"
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="justify-self-start text-[13.5px] text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
    >
      Back to sign in
    </button>
  );
}

const DEMO_ACCOUNTS = [
  {
    email: "admin@example.com",
    name: "Asha Shrestha",
    role: "Super admin",
    what: "Change anything: users, roles, policies.",
  },
  {
    email: "auditor@example.com",
    name: "Bikash Rai",
    role: "Audit viewer",
    what: "Read-only. Every change is refused.",
  },
];

/** Demo only: one-click sign-in as a sample account, then the usual form below. */
function DemoAccounts({ pending, onPick }: { pending: boolean; onPick: (email: string) => void }) {
  return (
    <div className="mb-6">
      <p className="mb-2.5 text-[13px] text-[var(--muted-foreground)]">
        This is a demo with sample data. Pick an account:
      </p>
      <div className="grid gap-2">
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            disabled={pending}
            onClick={() => onPick(a.email)}
            className="group flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-subtle)] disabled:opacity-60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--primary-subtle)] text-[14px] font-semibold text-[var(--primary)] group-hover:bg-[var(--card)]">
              {a.name.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="text-[14px] font-medium">{a.role}</span>
                <span className="truncate text-[12.5px] text-[var(--muted-foreground)]">
                  {a.name}
                </span>
              </span>
              <span className="block text-[12.5px] text-[var(--muted-foreground)]">{a.what}</span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3 text-[12.5px] text-[var(--muted-foreground)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        or use email (any password)
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
    </div>
  );
}
