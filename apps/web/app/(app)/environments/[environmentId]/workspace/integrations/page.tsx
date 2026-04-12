import { redirect } from "next/navigation";

const WorkspaceIntegrationsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/settings/workspace/integrations`);
};

export default WorkspaceIntegrationsPage;
