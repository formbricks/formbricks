import { redirect } from "next/navigation";

const Page = async (props: { params: Promise<{ environmentId: string; surveyId: string }> }) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/surveys/${params.surveyId}/summary`);
};

export default Page;
