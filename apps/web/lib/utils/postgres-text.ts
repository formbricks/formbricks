import { z } from "zod";

/** The reason a v3 400 gives, matching what the Hub relays for the same input (ENG-2745). */
export const NULL_BYTE_REASON = "must not contain NULL bytes";

const NULL_BYTE = "\u0000";

/**
 * A string PostgreSQL can bind.
 *
 * `text` cannot hold U+0000, so a bound parameter carrying one fails the whole query with 22021
 * (`invalid byte sequence for encoding "UTF8": 0x00`). Nothing maps that error, so a client-supplied
 * value with a NUL in it answers 500 instead of the 400 it deserves. Use this for any string that
 * reaches a query — a filter, or a field decoded from a cursor (ENG-3550).
 *
 * Nothing legitimate is lost by refusing it: no stored value can contain one either.
 */
export const zPostgresText = () => z.string().refine((value) => !value.includes(NULL_BYTE), NULL_BYTE_REASON);
