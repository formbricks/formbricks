import { redirect } from "next/navigation";

const EnvironmentPage = async (props) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/discover`);
};

export default EnvironmentPage;
