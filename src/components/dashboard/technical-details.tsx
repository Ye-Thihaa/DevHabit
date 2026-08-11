import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Wraps the statistics jargon (r, p-values, R², sd...) that this dashboard's
// cards compute honestly but that most readers don't need to see by default.
// Collapsed by default so a non-technical viewer gets a plain sentence first
// and the numbers stay one click away for anyone who wants to check the math.
export function TechnicalDetails({
  children,
  label = "Show the numbers behind this",
}: {
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Hide the numbers" : label}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
