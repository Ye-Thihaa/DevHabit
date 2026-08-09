import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Card({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate font-medium">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
