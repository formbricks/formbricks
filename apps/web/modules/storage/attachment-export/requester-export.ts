import "server-only";
import { prisma } from "@formbricks/database";
import { can } from "@/lib/authorization";
import type { TAttachmentExportStatus } from "./types";

export type TRequesterAttachmentExport = {
  id: string;
  surveyId: string;
  workspaceId: string;
  status: TAttachmentExportStatus;
};

/**
 * The export an emailed download link points at, for the page that link opens (ENG-6862). Found only for
 * the user who started it, and only while they can still read its survey: the same check the download
 * route makes, so losing access hides the export here too rather than only at download.
 */
export const getRequesterAttachmentExport = async ({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<TRequesterAttachmentExport | null> => {
  const row = await prisma.attachmentExport.findFirst({
    where: { id, requestedById: userId },
    select: { id: true, surveyId: true, workspaceId: true, status: true },
  });
  if (!row) return null;

  const allowed = await can({ type: "user", id: userId }, "survey.read", {
    type: "survey",
    id: row.surveyId,
  });
  return allowed ? row : null;
};
