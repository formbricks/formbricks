import { notFound } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TopicsSubtopicsPreview } from "./components/topics-subtopics-preview";

export default async function UnifyTopicsSubtopicsPage(
  props: Readonly<{ params: Promise<{ workspaceId: string }> }>
) {
  const t = await getTranslate();
  const params = await props.params;

  const { isOwner, isManager, hasReadAccess, hasReadWriteAccess, hasManageAccess, session } =
    await getWorkspaceAuth(params.workspaceId);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const hasAccess = isOwner || isManager || hasReadAccess || hasReadWriteAccess || hasManageAccess;
  if (!hasAccess) {
    return notFound();
  }

  const directories = await getFeedbackDirectoriesByWorkspaceId(params.workspaceId);
  const directoryMap = Object.fromEntries(directories.map((directory) => [directory.id, directory.name]));

  return <TopicsSubtopicsPreview workspaceId={params.workspaceId} directoryMap={directoryMap} />;
}
