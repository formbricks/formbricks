import { redirect } from "next/navigation";

const Page = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await props.params;
  redirect(`/organizations/${organizationId}/settings/general`);
};

export default Page;
