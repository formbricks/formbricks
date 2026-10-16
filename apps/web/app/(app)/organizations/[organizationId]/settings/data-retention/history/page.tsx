import { DataRetentionHistoryPage } from "@/modules/ee/data-retention/history-page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) =>
  DataRetentionHistoryPage(props);

export default Page;
