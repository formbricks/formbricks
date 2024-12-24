import { redirect } from "next/navigation";

type Params = Promise<{
  sharingKey: string;
}>;

const Page = async ({ params }: { params: Params }) => {
  return redirect(`/share/${(await params).sharingKey}/summary`);
};

export default Page;
