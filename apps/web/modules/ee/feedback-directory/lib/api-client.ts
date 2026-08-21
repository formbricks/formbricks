import { parseV3ApiError } from "@/modules/api/lib/v3-client";

/**
 * Client fetchers for the internal feedback-datasets routes. Mutations use an explicit timeout;
 * every call throws a parsed `V3ApiError` on a non-2xx response.
 */

const BASE_PATH = "/api/internal/feedback-datasets";
const MUTATION_TIMEOUT_MS = 15_000;

export type TPurgeFeedbackDatasetResponse = {
  datasetId: string;
  status: string;
};

/**
 * Ask the Hub to delete every feedback record in a dataset.
 *
 * Resolves once the purge has been *accepted*, not once it has run — the Hub performs it in the
 * background, so there is no deleted count and the records are still present when this returns.
 */
export async function purgeFeedbackDataset(datasetId: string): Promise<TPurgeFeedbackDatasetResponse> {
  const response = await fetch(`${BASE_PATH}/${encodeURIComponent(datasetId)}/purge`, {
    method: "POST",
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  return ((await response.json()) as { data: TPurgeFeedbackDatasetResponse }).data;
}
