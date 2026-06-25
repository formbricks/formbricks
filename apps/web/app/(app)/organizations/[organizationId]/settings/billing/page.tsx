import { PricingPage } from "@/modules/ee/billing/page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  return PricingPage(props);
};

export default Page;
