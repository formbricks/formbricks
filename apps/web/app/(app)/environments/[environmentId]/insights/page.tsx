import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { getInsights } from "@formbricks/ee/ai-analysis/lib/insight/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getUser } from "@formbricks/lib/user/service";
import { TTemplateRole } from "@formbricks/types/templates";
import { Card } from "@formbricks/ui/Card";
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

const Page = async ({ params }: SurveyTemplateProps) => {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Session not found");
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new Error("User not found");
  }

  const insights = await getInsights(params.environmentId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Insights" />
      {insights.map((insight) => (
        <Card key={insight.id} label={insight.title} description={insight.description} />
      ))}
    </PageContentWrapper>
  );
};

export default Page;
