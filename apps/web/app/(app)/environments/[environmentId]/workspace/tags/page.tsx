import { redirect } from "next/navigation";

const WorkspaceTagsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/settings/workspace/tags`);
};

export default WorkspaceTagsPage;
