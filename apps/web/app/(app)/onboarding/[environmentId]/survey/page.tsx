import { OnboardingSurvey } from "@/app/(app)/onboarding/[environmentId]/survey/components/OnboardingSurvey";
import { notFound } from "next/navigation";

interface OnboardingSurveyPageProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    channel?: string;
    industry?: string;
  };
}

const Page = async ({ params, searchParams }: OnboardingSurveyPageProps) => {
  const channel = searchParams.channel;
  const industry = searchParams.industry;
  if (!channel || !industry || industry !== "other") return notFound();
  return <OnboardingSurvey environmentId={params.environmentId} channel={channel} />;
};

export default Page;
