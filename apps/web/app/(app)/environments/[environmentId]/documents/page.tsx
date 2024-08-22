import { DocumentSearch } from "@/app/(app)/environments/[environmentId]/documents/components/DocumentSearch";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";
import { TTemplateRole } from "@formbricks/types/templates";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

export const metadata: Metadata = {
  title: "Your Surveys",
};

interface SurveyTemplateProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    role?: TTemplateRole;
  };
}

const Page = async ({ params, searchParams }: SurveyTemplateProps) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Session not found");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error("User not found");
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Documents" />
      <DocumentSearch environmentId={params.environmentId} />
    </PageContentWrapper>
  );
};

export default Page;
