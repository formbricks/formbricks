import { redirect } from "next/navigation";

const SettingsIndexPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/settings/workspace/general`);
};

export default SettingsIndexPage;
