import { z } from "zod";
import { hasNoNullByte } from "@formbricks/types/embedded-data";

/**
 * Free text a write stores in a Postgres text column: capped at `max`, and without the NUL character
 * Postgres can't store, so such a value is a 400 naming the field rather than a 500 from the insert.
 */
export const ZStoredText = (max: number) =>
  z.string().max(max).refine(hasNoNullByte, { error: "Must not contain NUL characters" });
