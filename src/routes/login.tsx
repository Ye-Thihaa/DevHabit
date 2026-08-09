import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useAuthActions } from "@convex-dev/auth/react";
import { Github, Loader2, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — devhabit" },
      {
        name: "description",
        content: "Sign in to devhabit to log today's habits and review your coding output trends.",
      },
      { property: "og:title", content: "Log in — devhabit" },
      {
        property: "og:description",
        content: "Sign in to devhabit to log habits and review your coding output trends.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative flex items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Terminal className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">devhabit</span>
        </Link>
        <ThemeToggle />
      </div>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-elevated sm:p-8">
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with GitHub to log today's entry and see where the week is heading.
          </p>

          <Button
            variant="outline"
            className="mt-6 w-full"
            disabled={signingIn}
            onClick={() => {
              setSigningIn(true);
              void signIn("github").catch(() => setSigningIn(false));
            }}
          >
            {signingIn ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Github className="size-4" />
            )}
            {signingIn ? "Redirecting to GitHub…" : "Continue with GitHub"}
          </Button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            We only use your GitHub username and public profile — no repo access, no write
            permissions.
          </p>
        </div>
      </main>
    </div>
  );
}
