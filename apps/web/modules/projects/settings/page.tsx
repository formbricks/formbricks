import { redirect } from "next/navigation";

export const ProjectSettingsPage = async (props) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/project/general`);
};
