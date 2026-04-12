import { redirect } from "next/navigation";

const WorkspaceTeamsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/settings/workspace/team-access`);
};

export default WorkspaceTeamsPage;
