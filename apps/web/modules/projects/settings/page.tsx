import { redirect } from "next/navigation";

export const ProjectSettingsPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/workspace/general`);
};
