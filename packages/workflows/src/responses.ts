import type { TCursorPaginationMeta } from "./contracts";
import { buildV3Headers } from "./http";

/**
 * Success envelope builders for the workflow handlers. Body shapes and headers mirror
 * `apps/web/app/api/v3/lib/response.ts` (`{ data }`, `{ data, meta }`, 201 + Location). Web-standard
 * `Response` keeps the package framework-agnostic.
 */

const JSON_CONTENT_TYPE = "application/json";

export const dataResponse = <T>(data: T, requestId: string): Response =>
  Response.json({ data }, { status: 200, headers: buildV3Headers(JSON_CONTENT_TYPE, requestId) });

export const listResponse = <T>(data: T[], meta: TCursorPaginationMeta, requestId: string): Response =>
  Response.json({ data, meta }, { status: 200, headers: buildV3Headers(JSON_CONTENT_TYPE, requestId) });

export const createdResponse = <T>(data: T, location: string, requestId: string): Response =>
  Response.json(
    { data },
    { status: 201, headers: buildV3Headers(JSON_CONTENT_TYPE, requestId, { Location: location }) }
  );
