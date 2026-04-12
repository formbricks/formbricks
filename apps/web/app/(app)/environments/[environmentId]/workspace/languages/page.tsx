import { redirect } from "next/navigation";

const WorkspaceLanguagesPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/settings/workspace/languages`);
};

export default WorkspaceLanguagesPage;
