import { z } from "zod";

/**
 * The reason a 400 gives for a NULL byte (v3 and the client identify call), matching what the Hub
 * relays for the same input (ENG-2745). The workflows package keeps its own copy
 * (`packages/workflows/src/contracts/postgres-text.ts`); the tests on both sides pin this exact
 * literal, so the two cannot drift apart unnoticed.
 */
export const NULL_BYTE_REASON = "must not contain NULL bytes";

const NULL_BYTE = "\u0000";

/** Whether `value` holds a U+0000, which no Postgres `text` column can store. */
export const hasNullByte = (value: string): boolean => value.includes(NULL_BYTE);

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
export const zPostgresText = () => z.string().refine((value) => !hasNullByte(value), NULL_BYTE_REASON);
