import { OnboardingSurvey } from "@/app/(app)/(onboarding)/organizations/[organizationId]/products/new/survey/components/OnboardingSurvey";
import { notFound } from "next/navigation";
import { TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";

interface OnboardingSurveyPageProps {
  params: {
    organizationId: string;
  };
  searchParams: {
    channel?: TProductConfigChannel;
    industry?: TProductConfigIndustry;
  };
}

const Page = async ({ params, searchParams }: OnboardingSurveyPageProps) => {
  const channel = searchParams.channel;
  const industry = searchParams.industry;
  if (!channel || !industry) return notFound();

  return <OnboardingSurvey organizationId={params.organizationId} channel={channel} />;
};

export default Page;
