import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DatePicker({
  date,
  onSelect,
  invalid,
  className,
}: {
  date: Date | undefined;
  onSelect: (d?: Date) => void;
  invalid?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start font-mono text-left font-normal",
            !date && "text-muted-foreground",
            invalid && "border-destructive",
            className,
          )}
        >
          <CalendarIcon className="size-4" />
          {date ? format(date, "yyyy-MM-dd") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className={cn("pointer-events-auto p-3")}
        />
      </PopoverContent>
    </Popover>
  );
}
