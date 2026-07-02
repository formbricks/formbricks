import { UnifyTopicsSubtopicsPage } from "@/modules/ee/unify-feedback/topics-subtopics/page";

const Page = (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  return UnifyTopicsSubtopicsPage(props);
};

export default Page;
