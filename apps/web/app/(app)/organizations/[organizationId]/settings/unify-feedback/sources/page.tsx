import { OrganizationFeedbackSourcesPage } from "@/modules/ee/unify-feedback/sources/page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  return OrganizationFeedbackSourcesPage(props);
};

export default Page;
