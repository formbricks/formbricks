import type { z } from "zod";
import { cleanNote } from "./clean-note";

/**
 * The parts of the code checks on an AI plan that every lane runs the same way (ENG-3479, ENG-6852):
 * the ranges a rating type allows, reading an answer's entries and skips for the refs its call was
 * asked about, the verdict on one ref, and the notes kept for the report. What an entry must hold to
 * pass — the roles of a Qualtrics question, the cells of a document line — stays in each lane's
 * `plan-checks.ts`.
 */

/** The ranges each rating type allows: what the survey's rating, CSAT and CES elements can show. */
export const IMPORT_PLAN_RANGES: Readonly<Record<"rating" | "csat" | "ces", readonly number[]>> = {
  rating: [3, 4, 5, 6, 7, 10],
  csat: [5],
  ces: [5, 7],
};

/** Whether a rating, CSAT or CES entry's range is one its type allows. */
export const isImportPlanRange = (type: keyof typeof IMPORT_PLAN_RANGES, range: number | null): boolean =>
  range !== null && IMPORT_PLAN_RANGES[type].includes(range);

/** The `ref` an answer's raw entry names, read before the entry is parsed; `null` when it has none. */
export const readPlanRef = (entry: unknown): string | null =>
  typeof entry === "object" && entry !== null && "ref" in entry && typeof entry.ref === "string"
    ? entry.ref
    : null;

/** Record a reason a ref fails, once each. */
export const addPlanFailure = <TFailure extends string>(
  failures: Map<string, TFailure[]>,
  ref: string,
  reason: TFailure
): void => {
  const reasons = failures.get(ref) ?? [];
  if (!reasons.includes(reason)) reasons.push(reason);
  failures.set(ref, reasons);
};

/**
 * An answer's entries by ref, for the refs its call was asked about; an entry for any other ref is
 * ignored. An entry that does not parse is reported through `onInvalid` and kept out.
 */
export const collectPlanEntries = <TEntry>(
  raw: readonly unknown[],
  refs: ReadonlySet<string>,
  schema: z.ZodType<TEntry>,
  onInvalid: (ref: string) => void
): Map<string, TEntry[]> => {
  const entries = new Map<string, TEntry[]>();
  for (const item of raw) {
    const ref = readPlanRef(item);
    if (ref === null || !refs.has(ref)) continue;
    const parsed = schema.safeParse(item);
    if (parsed.success) entries.set(ref, [...(entries.get(ref) ?? []), parsed.data]);
    else onInvalid(ref);
  }
  return entries;
};

/** An answer's skip reasons by ref, for the refs its call was asked about. */
export const collectPlanSkips = (
  raw: readonly unknown[],
  refs: ReadonlySet<string>,
  schema: z.ZodType<{ ref: string; reason: string }>
): Map<string, string[]> => {
  const skips = new Map<string, string[]>();
  for (const item of raw) {
    const parsed = schema.safeParse(item);
    if (!parsed.success || !refs.has(parsed.data.ref)) continue;
    skips.set(parsed.data.ref, [...(skips.get(parsed.data.ref) ?? []), parsed.data.reason]);
  }
  return skips;
};

export type TPlanRefVerdict<TEntry> =
  | { kind: "failed"; reason: "duplicate_ref" | "placed_and_skipped" }
  /** Skipped by the AI, with its cleaned reason (or `null`). */
  | { kind: "skipped"; reason: string | null }
  | { kind: "missing" }
  /** Placed once: the entry still has to pass the lane's own checks. */
  | { kind: "placed"; entry: TEntry };

/** One ref's verdict from what an answer gave for it: placed once, skipped once, neither, or failed. */
export const judgePlanRef = <TEntry>(
  entries: readonly TEntry[],
  skips: readonly string[]
): TPlanRefVerdict<TEntry> => {
  if (entries.length > 1 || skips.length > 1) return { kind: "failed", reason: "duplicate_ref" };
  if (skips.length === 1 && entries.length === 1) return { kind: "failed", reason: "placed_and_skipped" };
  if (skips.length === 1) return { kind: "skipped", reason: cleanNote(skips[0]) || null };
  if (entries.length === 0) return { kind: "missing" };
  return { kind: "placed", entry: entries[0] };
};

/** The notes on an entry's rules, cleaned. One per rule, empty included: the report reads them by index. */
export const cleanRuleNotes = (notes: readonly string[]): string[] => notes.map(cleanNote);
