import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { TTemplateChannel, TTemplateIndustry, TTemplateRole } from "@formbricks/types/templates";
import { TemplateContainerWithPreview } from "./components/TemplateContainer";

interface SurveyTemplateProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    channel?: TTemplateChannel;
    industry?: TTemplateIndustry;
    role?: TTemplateRole;
  };
}

const Page = async ({ params, searchParams }: SurveyTemplateProps) => {
  const session = await getServerSession(authOptions);
  const environmentId = params.environmentId;
  const prefilledFilters = [
    searchParams.channel ?? null,
    searchParams.industry ?? null,
    searchParams.role ?? null,
  ];

  const [environment, product] = await Promise.all([
    getEnvironment(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!session) {
    throw new Error("Session not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  if (!environment) {
    throw new Error("Environment not found");
  }

  return (
    <TemplateContainerWithPreview
      environmentId={environmentId}
      user={session.user}
      environment={environment}
      product={product}
      prefilledFilters={prefilledFilters}
    />
  );
};

export default Page;
