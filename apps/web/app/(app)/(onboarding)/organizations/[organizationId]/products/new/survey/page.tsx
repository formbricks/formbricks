import { OnboardingSurvey } from "@/app/(app)/(onboarding)/organizations/[organizationId]/products/new/survey/components/OnboardingSurvey";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
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
  const session = await getServerSession(authOptions);
  if (!session) {
    return redirect(`/auth/login`);
  }

  const channel = searchParams.channel;
  const industry = searchParams.industry;
  if (!channel || !industry) return notFound();

  return (
    <OnboardingSurvey organizationId={params.organizationId} channel={channel} userId={session.user.id} />
  );
};

export default Page;
