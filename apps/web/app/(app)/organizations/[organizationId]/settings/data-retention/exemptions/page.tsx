import { DataRetentionExemptionsPage } from "@/modules/ee/data-retention/exemptions-page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) =>
  DataRetentionExemptionsPage(props);

export default Page;
