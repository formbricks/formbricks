import { UsagePage } from "@/modules/organization/usage/page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  return UsagePage(props);
};

export default Page;
