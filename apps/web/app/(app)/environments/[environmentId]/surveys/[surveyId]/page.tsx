import { redirect } from "next/navigation";

const Page = ({ params }) => {
  return redirect(`/environments/${params.environmentId}/surveys/${params.surveyId}/summary`);
};

export default Page;
