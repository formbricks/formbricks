import { redirect } from "next/navigation";

const Page = async (props: { params: Promise<{ workspaceId: string; surveyId: string }> }) => {
  const params = await props.params;
  return redirect(`/workspaces/${params.workspaceId}/surveys/${params.surveyId}/summary`);
};

export default Page;
