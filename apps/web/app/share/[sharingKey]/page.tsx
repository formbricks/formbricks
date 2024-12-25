import { redirect } from "next/navigation";

type Params = Promise<{
  sharingKey: string;
}>;

const Page = async (props: { params: Params }) => {
  const params = await props.params;
  return redirect(`/share/${params.sharingKey}/summary`);
};

export default Page;
