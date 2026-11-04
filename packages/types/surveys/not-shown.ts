import { z } from "zod";

/**
 * The not-shown record (ENG-6936, ADR 0024): what a respondent was **not shown**, decided by the
 * survey while they answer and stored on the response as it was at answer time. Results read it
 * instead of re-running today's rules, so editing a show-if mid-field never changes past results.
 *
 * It lists only what was kept from the respondent, by stable ids (locked once published, ADR 0020).
 * "Not listed" means shown or never reached. `null` on a stored response means unknown (a response
 * from before 6.2 or from an older cached bundle), and results read those as before.
 *
 * `options`, `rows` and `columns` are part of the approved shape (json-shapes §8) and filled by
 * option, row and column show-if and Hidden (ENG-6937); the record accepts and stores them now.
 */

/** Ids a list may carry. The same ceiling as a survey's block order: no real survey lists more. */
export const MAX_NOT_SHOWN_IDS = 1000;
/** Elements a per-element map (`options`, `rows`, `columns`) may key. */
export const MAX_NOT_SHOWN_MAP_KEYS = 1000;
/** Characters an id may have. Element, block and option ids are far shorter. */
export const MAX_NOT_SHOWN_ID_LENGTH = 200;

// The record is stored as jsonb, which cannot hold U+0000: refusing it here answers 400, not 500.
const ZNotShownId = z
  .string()
  .min(1)
  .max(MAX_NOT_SHOWN_ID_LENGTH)
  .refine((id) => !id.includes("\u0000"), "must not contain NULL bytes");
const ZNotShownIds = z.array(ZNotShownId).max(MAX_NOT_SHOWN_IDS);
const ZNotShownMap = z
  .record(ZNotShownId, ZNotShownIds)
  .refine((map) => Object.keys(map).length <= MAX_NOT_SHOWN_MAP_KEYS, {
    error: `A not-shown map may key at most ${MAX_NOT_SHOWN_MAP_KEYS} elements`,
  });

/**
 * What the survey sends with every create and update. Closed at every level, and capped, because the
 * client routes are public.
 */
export const ZResponseNotShownInput = z.strictObject({
  /** Block ids skipped by show-if, or because every element on them was hidden. */
  blocks: ZNotShownIds.optional(),
  /** Element ids hidden by show-if, or skipped with no options left. */
  elements: ZNotShownIds.optional(),
  /** Element id → option ids not shown. */
  options: ZNotShownMap.optional(),
  /** Matrix element id → row ids not shown. */
  rows: ZNotShownMap.optional(),
  /** Matrix element id → column ids not shown. */
  columns: ZNotShownMap.optional(),
});

/**
 * A stored record, as read. The same keys without the input caps: a cap applies to what a caller
 * sends and never makes a stored response unreadable.
 */
export const ZResponseNotShown = z.object({
  blocks: z.array(z.string()).optional(),
  elements: z.array(z.string()).optional(),
  options: z.record(z.string(), z.array(z.string())).optional(),
  rows: z.record(z.string(), z.array(z.string())).optional(),
  columns: z.record(z.string(), z.array(z.string())).optional(),
});

export type TResponseNotShown = z.infer<typeof ZResponseNotShown>;

type TBlockLike = { id: string; elements: readonly { id: string }[] };

/**
 * The elements a record says the respondent was not shown: those it lists, plus every element of the
 * blocks it lists. Only ids of `blocks`' elements come back, so a record naming anything else (a
 * hidden field, the verified email, a deleted element) never reaches the answers through it.
 *
 * `null` or `undefined` (unknown) returns an empty set, which reads as today.
 */
export const getNotShownElementIds = (
  record: TResponseNotShown | null | undefined,
  blocks: readonly TBlockLike[]
): Set<string> => {
  const notShown = new Set<string>();
  if (!record) return notShown;

  const listedBlocks = new Set(record.blocks ?? []);
  const listedElements = new Set(record.elements ?? []);
  if (listedBlocks.size === 0 && listedElements.size === 0) return notShown;

  for (const block of blocks) {
    const wholeBlock = listedBlocks.has(block.id);
    for (const element of block.elements) {
      if (wholeBlock || listedElements.has(element.id)) notShown.add(element.id);
    }
  }
  return notShown;
};
