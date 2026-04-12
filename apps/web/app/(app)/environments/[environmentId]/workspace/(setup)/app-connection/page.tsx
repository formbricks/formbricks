import { redirect } from "next/navigation";

const AppConnectionPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/settings/workspace/connect`);
};

export default AppConnectionPage;
