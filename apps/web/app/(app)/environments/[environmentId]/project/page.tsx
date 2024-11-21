import { redirect } from "next/navigation";

const Page = async (props) => {
  const params = await props.params;
  return redirect(`/environments/${params.environmentId}/project/general`);
};

export default Page;
