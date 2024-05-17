import { redirect } from "next/navigation";

const Page = ({ params }) => {
  return redirect(`/environments/${params.environmentId}/product/general`);
};

export default Page;
