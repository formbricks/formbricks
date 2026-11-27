/**
 * What a filter chip's `×` does (ENG-7372): `remove` takes the filter off, `unlock` takes a filter locked for
 * everyone off (offered only to whoever may, by passing a remove handler), and `none` shows no `×` — a chip
 * without a handler, or one locked for the reader alone by their data access, which they can never remove.
 */
export type TChipRemoval = "none" | "remove" | "unlock";

export const getChipRemoval = ({
  hasRemoveHandler,
  isLocked,
  lockedFor = "everyone",
}: Readonly<{
  hasRemoveHandler: boolean;
  isLocked: boolean;
  lockedFor?: "everyone" | "you";
}>): TChipRemoval => {
  if (!hasRemoveHandler) return "none";
  if (!isLocked) return "remove";
  return lockedFor === "you" ? "none" : "unlock";
};
