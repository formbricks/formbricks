import { redirect } from "next/navigation";

const Page = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  return redirect(`/workspaces/${params.workspaceId}/settings/profile`);
};

export default Page;
