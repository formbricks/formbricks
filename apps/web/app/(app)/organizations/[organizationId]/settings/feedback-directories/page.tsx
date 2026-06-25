import { FeedbackDirectoriesPage } from "@/modules/ee/feedback-directory/page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  return FeedbackDirectoriesPage(props);
};

export default Page;
