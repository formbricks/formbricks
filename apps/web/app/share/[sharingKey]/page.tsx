import { redirect } from "next/navigation";

const Page = ({ params }) => {
  return redirect(`/share/${params.sharingKey}/summary`);
};

export default Page;
