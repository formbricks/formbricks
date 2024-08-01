import { getServerSession } from "next-auth";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";
import { TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";
import { TTemplateRole } from "@formbricks/types/templates";
import { TemplateContainerWithPreview } from "./components/TemplateContainer";

interface SurveyTemplateProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    channel?: TProductConfigChannel;
    industry?: TProductConfigIndustry;
    role?: TTemplateRole;
  };
}

const Page = async ({ params, searchParams }: SurveyTemplateProps) => {
  const session = await getServerSession(authOptions);
  const environmentId = params.environmentId;

  if (!session) {
    throw new Error("Session not found");
  }

  const [user, environment, product] = await Promise.all([
    getUser(session.user.id),
    getEnvironment(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  if (!product) {
    throw new Error("Product not found");
  }

  if (!environment) {
    throw new Error("Environment not found");
  }

  const prefilledFilters = [product.config.channel, product.config.industry, searchParams.role ?? null];

  return (
    <TemplateContainerWithPreview
      environmentId={environmentId}
      user={user}
      environment={environment}
      product={product}
      prefilledFilters={prefilledFilters}
    />
  );
};

export default Page;
