import { z } from "zod";

/**
 * A string PostgreSQL can bind. `text` cannot hold U+0000, so a query parameter carrying one fails
 * with 22021 and the request answers 500 instead of 400. Use it for any client string that reaches a
 * query — a filter, or a field decoded from a cursor (ENG-3550).
 *
 * The same rule as `apps/web`'s `zPostgresText`, copied because this package imports nothing from the
 * app. Deliberately not re-exported from `./index`: it is an internal detail, not package surface.
 */
export const zPostgresText = () =>
  z.string().refine((value) => !value.includes("\u0000"), "must not contain NULL bytes");
