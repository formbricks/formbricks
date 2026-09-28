import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TMatrixQuestion } from "./matrix-questions";

/** Client fetcher for the internal matrix-questions route. Forwards the TanStack `signal`. */
export async function fetchMatrixQuestions(params: {
  workspaceId: string;
  feedbackDirectoryId: string;
  signal?: AbortSignal;
}): Promise<TMatrixQuestion[]> {
  const query = new URLSearchParams({ feedbackDirectoryId: params.feedbackDirectoryId });
  const response = await fetch(`/api/workspaces/${params.workspaceId}/matrix-questions?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: params.signal,
  });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: TMatrixQuestion[] }).data;
}
