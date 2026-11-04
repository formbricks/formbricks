import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@formbricks/database";
import type { Session } from "@formbricks/types/auth";
import { authorizeAttachmentExportAccess } from "./authorize";
import type { TAttachmentExportStatus } from "./types";

export type TRequesterAttachmentExport = {
  id: string;
  surveyId: string;
  workspaceId: string;
  status: TAttachmentExportStatus;
};

/**
 * The export an emailed download link points at, for the page that link opens (ENG-6862). Found only for
 * the user who started it, and only while `authorizeAttachmentExportAccess` — the gate the download route
 * goes through — still lets them read its survey, so losing access hides the export here too.
 */
export const getRequesterAttachmentExport = async ({
  id,
  session,
}: {
  id: string;
  session: Session;
}): Promise<TRequesterAttachmentExport | null> => {
  const row = await prisma.attachmentExport.findFirst({
    where: { id, requestedById: session.user.id },
    select: { id: true, surveyId: true, workspaceId: true, status: true },
  });
  if (!row) return null;

  // The gate answers routes, so it takes a request id and instance for its problem documents; this page
  // only needs to know whether it refused.
  const access = await authorizeAttachmentExportAccess({
    surveyId: row.surveyId,
    authentication: session,
    requestId: randomUUID(),
    instance: `/attachment-exports/${id}`,
  });
  return access.response ? null : row;
};
