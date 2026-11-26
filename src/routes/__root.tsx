import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { BadgeMark } from "@/components/iam/BadgeMark";
import { themeScript } from "@/components/iam/ThemeToggle";
import { AuthProvider } from "@/context/AuthContext";
import { AuthzProvider } from "@/context/AuthzContext";
import { Toaster } from "@/components/ui/sonner";
import { ApiError } from "@/api/client";
import { APP_NAME, pageTitle } from "@/lib/brand";

function NotFoundComponent() {
  return (
    <Notice
      title="Nothing at this address"
      body="The page may have moved, or the link has a typo."
      action={
        <Link to="/admin/dashboard" className="text-[var(--primary)] hover:underline">
          Go to the overview
        </Link>
      }
    />
  );
}

/** Quiet full-page message used for 404s and load errors. */
function Notice({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-start justify-center px-4 pt-[18vh]">
      <div className="max-w-md">
        <BadgeMark className="mb-5 size-8 text-[var(--primary)]" />
        <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[15px] text-[var(--muted-foreground)]">{body}</p>
        <div className="mt-5 text-[14px] font-medium">{action}</div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    if (!(error instanceof ApiError && error.status === 403)) {
      console.error(error);
    }
  }, [error]);

  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[13px] text-[var(--muted-foreground)]">
          Not available for your access level.
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="ml-3 text-[var(--primary)] hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Notice
      title="This page didn't load"
      body="Something went wrong while loading it. Try again; if it keeps failing, the IAM may be down."
      action={
        <button
          type="button"
          className="text-[var(--primary)] hover:underline"
          onClick={() => {
            void router.invalidate();
            reset();
          }}
        >
          Try again
        </button>
      }
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: pageTitle() },
      {
        name: "description",
        content: "Admin console for spring-iam: users, roles, scopes, policies and audit.",
      },
      { property: "og:title", content: APP_NAME },
      {
        property: "og:description",
        content: "Admin console for spring-iam: users, roles, scopes, policies and audit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // The theme script and browser extensions touch <html> and <body> before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthzProvider>
          <Outlet />
          <Toaster richColors closeButton position="top-right" duration={4000} />
        </AuthzProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
