import { createMissingOverrideHandler } from "@/src/processors/missing-override";
import type { TResponsePipelineJobData } from "@/src/types";

// TODO(#1548): Keep this fallback until every runtime that starts BullMQ registers the app override.
// Only the ids are logged — the payload holds a full survey response and must never reach the logs.
export const processResponsePipelineJob = createMissingOverrideHandler<TResponsePipelineJobData>(
  "response pipeline",
  (data) => ({ event: data.event, surveyId: data.surveyId, workspaceId: data.workspaceId })
);
