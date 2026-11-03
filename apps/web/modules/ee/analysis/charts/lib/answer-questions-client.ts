import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TAnswerQuestion } from "@/modules/ee/analysis/lib/answer-filter";

/** Client fetcher for the internal answer-questions route. Forwards the TanStack `signal`. */
export async function fetchAnswerQuestions(params: {
  workspaceId: string;
  feedbackDirectoryId: string;
  signal?: AbortSignal;
}): Promise<TAnswerQuestion[]> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    datasetId: params.feedbackDirectoryId,
  });
  const response = await fetch(`/api/internal/answer-questions?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: params.signal,
  });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: TAnswerQuestion[] }).data;
}
