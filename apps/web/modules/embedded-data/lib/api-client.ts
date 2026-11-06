import type {
  TEmbeddedDataCreateBody,
  TEmbeddedDataPromoteBody,
  TEmbeddedDataUpdateBody,
} from "@/app/api/internal/embedded-data/schemas";
import type {
  TEmbeddedDataConflictDetails,
  TEmbeddedDataListItemResource,
  TEmbeddedDataResource,
  TEmbeddedDataUsageResource,
} from "@/app/api/internal/embedded-data/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";
import { V3ApiError } from "@/modules/api/lib/v3-client";

const BASE_PATH = "/api/internal/embedded-data";

const fieldPath = (id: string) => `${BASE_PATH}/${encodeURIComponent(id)}`;

/**
 * What a library write comes back with. The two refusals an author acts on — a key another field holds,
 * surveys that depend on the field as it is — are answers to render, not failures, so they come back as
 * values; anything else still throws.
 */
export type TEmbeddedDataWriteResult<TOk extends object = { field: TEmbeddedDataResource }> =
  | ({ status: "ok" } & TOk)
  /** `existingId` is only ever set by promote; a plain create has no replacement to offer. */
  | { status: "keyConflict"; existingId: string | null }
  | { status: "inUse"; message: string; usage: TEmbeddedDataUsageResource[] };

const isConflictDetails = (details: unknown): details is TEmbeddedDataConflictDetails =>
  typeof details === "object" &&
  details !== null &&
  ((details as { reason?: unknown }).reason === "key_conflict" ||
    (details as { reason?: unknown }).reason === "in_use");

const toWriteResult = async <TOk extends object>(
  write: () => Promise<TOk>
): Promise<TEmbeddedDataWriteResult<TOk>> => {
  try {
    return { status: "ok", ...(await write()) };
  } catch (error) {
    if (!(error instanceof V3ApiError) || error.status !== 409 || !isConflictDetails(error.details))
      throw error;
    return error.details.reason === "key_conflict"
      ? { status: "keyConflict", existingId: error.details.existingId }
      : { status: "inUse", message: error.detail, usage: error.details.usage };
  }
};

const withField = async (request: Promise<TEmbeddedDataResource>) => ({ field: await request });

export const listEmbeddedData = (workspaceId: string, { signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TEmbeddedDataListItemResource[]>(buildApiUrl(BASE_PATH, { workspaceId }), {
    signal,
  });

export const getEmbeddedDataUsage = (id: string, { signal }: { signal?: AbortSignal } = {}) =>
  getApiData<TEmbeddedDataUsageResource[]>(`${fieldPath(id)}/usage`, { signal });

export const createEmbeddedData = (workspaceId: string, body: TEmbeddedDataCreateBody) =>
  toWriteResult(() =>
    withField(
      sendApiRequest<TEmbeddedDataResource>(buildApiUrl(BASE_PATH, { workspaceId }), {
        method: "POST",
        body,
      })
    )
  );

export const updateEmbeddedData = (id: string, body: TEmbeddedDataUpdateBody) =>
  toWriteResult(() =>
    withField(sendApiRequest<TEmbeddedDataResource>(fieldPath(id), { method: "PATCH", body }))
  );

export const deleteEmbeddedData = (id: string) =>
  toWriteResult(async () => {
    await sendApiRequest<void>(fieldPath(id), { method: "DELETE" });
    return {};
  });

export const promoteEmbeddedData = (id: string, body: TEmbeddedDataPromoteBody) =>
  toWriteResult(() =>
    withField(sendApiRequest<TEmbeddedDataResource>(`${fieldPath(id)}/promotion`, { method: "POST", body }))
  );
