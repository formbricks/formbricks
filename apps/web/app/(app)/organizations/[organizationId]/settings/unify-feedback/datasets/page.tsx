import { UnifyFeedbackRecordsPage } from "@/modules/ee/unify-feedback/page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  return UnifyFeedbackRecordsPage(props);
};

export default Page;
