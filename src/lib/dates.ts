// Dates are handled as plain ISO strings ("2026-08-09") everywhere, matching
// how they are stored in Convex. Using Date objects for range boundaries drags
// in local-timezone offsets, which shifts days across midnight and quietly
// misaligns a log with its GitHub row.

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoStr(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
