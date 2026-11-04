import { createMissingOverrideHandler } from "@/src/processors/missing-override";
import type { TAttachmentExportJobData } from "@/src/types";

/**
 * Default handle for `attachment-export.process`. The build lives in `apps/web` and is registered as a
 * runtime override (ENG-6862); this fallback only runs when no override is wired, so it logs and throws
 * rather than silently leaving the export queued.
 */
export const processAttachmentExportJob = createMissingOverrideHandler<TAttachmentExportJobData>(
  "attachment export",
  (data) => ({
    attachmentExportId: data.attachmentExportId,
    workspaceId: data.workspaceId,
  })
);
