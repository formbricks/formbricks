import { redirect } from "next/navigation";

const Page = ({ params }) => {
  return redirect(`/environments/${params.environmentId}/surveys`);
};

export default Page;
