import { InviteOrganizationMember } from "@/app/(app)/(onboarding)/environments/[environmentId]/connect/components/InviteOrganizationMember";
import { XIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { Button } from "@formbricks/ui/Button";
import { Header } from "@formbricks/ui/Header";

interface InvitePageProps {
  params: {
    environmentId: string;
  };
}

const Page = async ({ params }: InvitePageProps) => {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }
  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error("Organization not Found");
  }

  const membership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return notFound();
  }

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center">
      <Header
        title="Who is your favorite engineer?"
        subtitle="Invite your tech-savvy co-worker to help with the setup 🤓"
      />
      <div className="space-y-4 text-center">
        <p className="text-4xl font-medium text-slate-800"></p>
        <p className="text-sm text-slate-500"></p>
      </div>
      <InviteOrganizationMember organization={organization} environmentId={params.environmentId} />
      <Button
        className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
        variant="minimal"
        href={`/environments/${params.environmentId}/`}>
        <XIcon className="h-7 w-7" strokeWidth={1.5} />
      </Button>
    </div>
  );
};

export default Page;
