/**
 * Columns a read without a `select` must not return — passed as `omit` to every Prisma client that
 * stands in for the app's: the real one in `client.ts` and the integration harness's Boolean-shaped
 * one (apps/web/integration/db-boolean.ts). One constant, so the two cannot drift.
 *
 * `Response.ingestFlags` is Embedded Data ingest bookkeeping (ENG-1845) with one reader — the response
 * update in apps/web/lib/response/service.ts — which selects it explicitly, and an explicit `select`
 * still returns an omitted column. Every other read is a consumer: without this, the v2 management
 * responses routes and the pipeline payload served an internal column that no OpenAPI bundle describes
 * (ENG-2955). Omitted at the client rather than per query so the next internal column is one line here,
 * not a hunt through every route that forgot a `select`.
 */
export const PRISMA_GLOBAL_OMIT = { response: { ingestFlags: true } } as const;
