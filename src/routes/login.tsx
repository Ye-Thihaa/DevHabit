import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Github, Terminal } from "lucide-react";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
            Log today's entry and see where the week is heading.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/dashboard" });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <span className="font-mono text-xs text-muted-foreground">Forgot?</span>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="font-mono text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: "/dashboard" })}
          >
            <Github className="size-4" /> Continue with GitHub
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/login" className="text-foreground underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
