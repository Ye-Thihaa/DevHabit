import { describe, expect, test } from "vitest";

import { escapeCsvValue, toCsv } from "./csv";

describe("escapeCsvValue", () => {
  // Blank must stay distinguishable from a real zero — "no data for that
  // field that day" is a different claim from "zero commits".
  test("null and undefined become blank, but zero stays zero", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
    expect(escapeCsvValue(0)).toBe("0");
  });

  test("quotes fields containing a comma, quote or newline", () => {
    expect(escapeCsvValue("a,b")).toBe('"a,b"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue("line1\nline2")).toBe('"line1\nline2"');
  });

  test("leaves an ordinary value alone", () => {
    expect(escapeCsvValue("wakatime")).toBe("wakatime");
    expect(escapeCsvValue("2026-08-11")).toBe("2026-08-11");
  });

  // Excel executes a cell starting with = as a formula, which turns an
  // exported field into a code path in someone's spreadsheet.
  test("defuses values Excel would read as a formula", () => {
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("+44")).toBe("'+44");
    expect(escapeCsvValue("@here")).toBe("'@here");
  });

  test("drops NaN and Infinity rather than writing them as text", () => {
    expect(escapeCsvValue(NaN)).toBe("");
    expect(escapeCsvValue(Infinity)).toBe("");
  });
});

describe("toCsv", () => {
  const columns = [
    { key: "date", header: "Date" },
    { key: "commits", header: "Commits" },
  ] as const;

  test("writes a header row and CRLF line endings", () => {
    const csv = toCsv([{ date: "2026-08-11", commits: 3 }], columns);
    expect(csv).toBe("Date,Commits\r\n2026-08-11,3");
  });

  test("emits only the header when there are no rows", () => {
    expect(toCsv([], columns)).toBe("Date,Commits");
  });

  test("a missing field becomes blank rather than the string undefined", () => {
    const csv = toCsv([{ date: "2026-08-11", commits: null }], columns);
    expect(csv).toBe("Date,Commits\r\n2026-08-11,");
  });
});
