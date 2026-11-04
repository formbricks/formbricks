import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { getRequesterAttachmentExport } from "@/modules/storage/attachment-export/requester-export";
import { AttachmentExportDownload } from "./components/AttachmentExportDownload";

/**
 * `/attachment-exports/{exportId}`: where the "your attachments are ready" email points (ENG-6862).
 *
 * Kept outside `/workspaces/…`, whose layout sends a signed-out visitor to login without a way back; this
 * page keeps the link as the callback, so signing in lands here again. The export shows only to its
 * requester while they can read the survey; the download goes through the audited download route, which
 * mints a fresh presigned URL.
 */
const Page = async ({ params }: Readonly<{ params: Promise<{ exportId: string }> }>) => {
  const { exportId } = await params;
  const session = await getSession();
  if (!session?.user) {
    const callbackUrl = encodeURIComponent(`/attachment-exports/${exportId}`);
    redirect(`/auth/login?callbackUrl=${callbackUrl}`);
  }

  const t = await getTranslate();
  const attachmentExport = z.cuid2().safeParse(exportId).success
    ? await getRequesterAttachmentExport({ id: exportId, session })
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold text-slate-900">
          {t("workspace.surveys.responses.attachment_export_page_title")}
        </h1>
        <AttachmentExportDownload
          attachmentExport={
            attachmentExport
              ? {
                  id: attachmentExport.id,
                  surveyId: attachmentExport.surveyId,
                  workspaceId: attachmentExport.workspaceId,
                  status: attachmentExport.status,
                }
              : null
          }
        />
      </div>
    </div>
  );
};

export default Page;
