import { DataRetentionPoliciesPage } from "@/modules/ee/data-retention/policies-page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) =>
  DataRetentionPoliciesPage(props);

export default Page;
