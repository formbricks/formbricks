import { InviteOrganizationMember } from "@/app/(app)/onboarding/[environmentId]/connect/components/InviteOrganizationMember";
import { OnboardingTitle } from "@/app/(app)/onboarding/components/OnboardingTitle";
import { notFound } from "next/navigation";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

interface InvitePageProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    channel?: string;
    industry?: string;
  };
}

const Page = async ({ params, searchParams }: InvitePageProps) => {
  const channel = searchParams.channel;
  const industry = searchParams.industry;
  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!channel || !industry) return notFound();

  if (!organization) {
    throw new Error("Organization not Found");
  }

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center">
      <OnboardingTitle
        title="Invite your organization to help out"
        subtitle="Ask your tech-savvy co-worker to finish the setup:"
      />
      <div className="space-y-4 text-center">
        <p className="text-4xl font-medium text-slate-800"></p>
        <p className="text-sm text-slate-500"></p>
      </div>
      <InviteOrganizationMember organization={organization} environmentId={params.environmentId} />
    </div>
  );
};

export default Page;
