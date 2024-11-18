import { redirect } from "next/navigation";

const Page = async (props) => {
  const params = await props.params;
  return redirect(`/share/${params.sharingKey}/summary`);
};

export default Page;
