import { redirect } from "next/navigation";

const Page = ({ params }) => {
  return redirect(`/environments/${params.environmentId}/settings/profile`);
};

export default Page;
