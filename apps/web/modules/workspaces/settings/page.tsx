import { redirect } from "next/navigation";

export const WorkspaceSettingsPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  return redirect(`/workspaces/${params.workspaceId}/settings/general`);
};
