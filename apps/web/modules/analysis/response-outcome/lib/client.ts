import type { TResponseOutcome } from "@formbricks/types/responses";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import { chunkIds } from "./outcome";

type TRequest = { url: string; init: RequestInit & { body: string } };

const JSON_HEADERS = { "Content-Type": "application/json" };

export const buildSetOutcomeRequest = (responseId: string, outcome: TResponseOutcome | null): TRequest => ({
  url: `/api/v3/responses/${encodeURIComponent(responseId)}`,
  init: { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ outcome }) },
});

export const buildBatchOutcomeRequest = (
  workspaceId: string,
  ids: string[],
  outcome: TResponseOutcome | null
): TRequest => ({
  url: `/api/v3/responses/batch-outcome?${new URLSearchParams({ workspaceId }).toString()}`,
  init: { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ ids, outcome }) },
});

const send = async ({ url, init }: TRequest): Promise<Response> => {
  const response = await fetch(url, init);
  if (!response.ok) throw await parseV3ApiError(response);
  return response;
};

export const setResponseOutcome = async (
  responseId: string,
  outcome: TResponseOutcome | null
): Promise<void> => {
  await send(buildSetOutcomeRequest(responseId, outcome));
};

export const setResponsesOutcomeBatch = async (
  workspaceId: string,
  ids: string[],
  outcome: TResponseOutcome | null
): Promise<{ updated: number }> => {
  const response = await send(buildBatchOutcomeRequest(workspaceId, ids, outcome));
  const body = (await response.json()) as { data: { updated: number } };
  return { updated: body.data.updated };
};

/** A run that stopped part-way: `doneIds` were saved, `cause` is why the next batch was not. */
export class OutcomeBatchError extends Error {
  readonly doneIds: string[];
  readonly cause: unknown;

  constructor(cause: unknown, doneIds: string[]) {
    super(cause instanceof Error ? cause.message : "Setting the outcome failed");
    this.name = "OutcomeBatchError";
    this.cause = cause;
    this.doneIds = doneIds;
  }
}

/**
 * One call per batch of up to 100 ids, never one per id. Sequential, so a refusal stops the run at the
 * first batch instead of firing the rest.
 */
export const setOutcomeInBatches = async (
  ids: string[],
  sendBatch: (chunk: string[]) => Promise<{ updated: number }>
): Promise<{ doneIds: string[]; updated: number }> => {
  const doneIds: string[] = [];
  let updated = 0;
  for (const chunk of chunkIds(ids)) {
    try {
      updated += (await sendBatch(chunk)).updated;
    } catch (error) {
      throw new OutcomeBatchError(error, doneIds);
    }
    doneIds.push(...chunk);
  }
  return { doneIds, updated };
};
