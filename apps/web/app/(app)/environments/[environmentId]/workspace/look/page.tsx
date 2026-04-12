import { redirect } from "next/navigation";

const WorkspaceLookPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/settings/workspace/appearance`);
};

export default WorkspaceLookPage;
