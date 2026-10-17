import { readCreativesApiData, requestCreativesApi } from "./creatives-api-client";
import type { TCreateCreativeBody, TCreativePatchBody, TCreativeResource } from "./editor-form";

/**
 * The calls that read and write one creative, and its query key. Every creative query key starts with
 * `["creatives"]`; the list's live under `creativeListKeys.all` (`list-api.ts`), which a write here
 * invalidates to refresh it. The editor and the summary both read the creative under
 * `creativeKeys.detail`, so a status one of them saves is what the other shows.
 */

export const creativeKeys = {
  all: ["creatives", "detail"] as const,
  detail: (creativeId: string) => [...creativeKeys.all, creativeId] as const,
};

export const createCreative = async (body: TCreateCreativeBody): Promise<TCreativeResource> =>
  readCreativesApiData(await requestCreativesApi({ method: "POST", body }));

export const getCreative = async (creativeId: string, signal?: AbortSignal): Promise<TCreativeResource> =>
  readCreativesApiData(await requestCreativesApi({ path: [creativeId], signal }));

export const patchCreative = async (
  creativeId: string,
  body: TCreativePatchBody
): Promise<TCreativeResource> =>
  readCreativesApiData(await requestCreativesApi({ path: [creativeId], method: "PATCH", body }));
