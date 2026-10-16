import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TCreateCreativeBody, TCreativePatchBody, TCreativeResource } from "./editor-form";

/**
 * The editor's calls to API v3 Creatives and their query keys. Every creative query key starts with
 * `["creatives"]`; the list (ENG-3996) lives under `["creatives", "list"]`, so a write here invalidates
 * that prefix to refresh it.
 */

export const creativeEditorKeys = {
  all: ["creatives", "editor"] as const,
  detail: (creativeId: string) => [...creativeEditorKeys.all, creativeId] as const,
};

export const CREATIVES_LIST_QUERY_KEY = ["creatives", "list"] as const;

const creativePath = (creativeId: string) => `/api/v3/creatives/${encodeURIComponent(creativeId)}`;

const readCreative = async (response: Response): Promise<TCreativeResource> => {
  if (!response.ok) throw await parseV3ApiError(response);
  const body = (await response.json()) as { data: TCreativeResource };
  return body.data;
};

const sendJson = (url: string, method: "POST" | "PATCH", body: unknown): Promise<Response> =>
  fetch(url, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const createCreative = async (body: TCreateCreativeBody): Promise<TCreativeResource> =>
  readCreative(await sendJson("/api/v3/creatives", "POST", body));

export const getCreative = async (creativeId: string, signal?: AbortSignal): Promise<TCreativeResource> =>
  readCreative(await fetch(creativePath(creativeId), { method: "GET", cache: "no-store", signal }));

export const patchCreative = async (
  creativeId: string,
  body: TCreativePatchBody
): Promise<TCreativeResource> => readCreative(await sendJson(creativePath(creativeId), "PATCH", body));
