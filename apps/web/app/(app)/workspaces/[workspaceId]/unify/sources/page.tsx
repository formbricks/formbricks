import { redirect } from "next/navigation";

export default async function UnifySourcesPage(props: { params: Promise<{ workspaceId: string }> }) {
  const params = await props.params;
  redirect(`/workspaces/${params.workspaceId}/settings/workspace/feedback-sources`);
}
