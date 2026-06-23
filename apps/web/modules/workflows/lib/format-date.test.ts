import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { formatRelativeDate } from "@/modules/workflows/lib/format-date";

const anchor = new Date("2024-09-15T17:01:00.000Z");

// Test stub for i18next's TFunction — echoes the key plus its interpolation values so the tests
// can match on key + payload without needing real translation files loaded.
const t = ((key: string, options?: Record<string, unknown>) => {
  if (key === "workspace.workflows.relative_today") return `Today, ${options?.time}`;
  if (key === "workspace.workflows.relative_yesterday") return `Yesterday, ${options?.time}`;
  if (key === "workspace.workflows.relative_days_ago") return `${options?.count} days ago, ${options?.time}`;
  return `${options?.date}, ${options?.time}`;
}) as unknown as TFunction;

describe("formatRelativeDate", () => {
  test("labels same-day timestamps with Today", () => {
    expect(formatRelativeDate("2024-09-15T16:23:00.000Z", anchor, t)).toMatch(/^Today, /);
  });

  test("labels timestamps from the previous day with Yesterday", () => {
    expect(formatRelativeDate("2024-09-14T13:00:00.000Z", anchor, t)).toMatch(/^Yesterday, /);
  });

  test("labels 2–6 days back as N days ago", () => {
    expect(formatRelativeDate("2024-09-13T08:15:00.000Z", anchor, t)).toMatch(/^2 days ago, /);
    expect(formatRelativeDate("2024-09-10T08:15:00.000Z", anchor, t)).toMatch(/^5 days ago, /);
  });

  test("falls back to month/day for older timestamps", () => {
    expect(formatRelativeDate("2024-08-15T09:00:00.000Z", anchor, t)).not.toMatch(/days ago|Yesterday|Today/);
  });
});
