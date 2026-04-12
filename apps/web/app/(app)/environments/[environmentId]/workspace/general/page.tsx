import { redirect } from "next/navigation";

const WorkspaceGeneralPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/settings/workspace/general`);
};

export default WorkspaceGeneralPage;
