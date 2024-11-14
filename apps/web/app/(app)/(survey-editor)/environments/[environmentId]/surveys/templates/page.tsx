import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUser } from "@formbricks/lib/user/service";
import { TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";
import { TTemplateRole } from "@formbricks/types/templates";
import { TemplateContainerWithPreview } from "./components/TemplateContainer";

interface SurveyTemplateProps {
  params: Promise<{
    environmentId: string;
  }>;
  searchParams: Promise<{
    channel?: TProductConfigChannel;
    industry?: TProductConfigIndustry;
    role?: TTemplateRole;
  }>;
}

const Page = async (props: SurveyTemplateProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const t = await getTranslations();
  const session = await getServerSession(authOptions);
  const environmentId = params.environmentId;

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  const [user, environment, product] = await Promise.all([
    getUser(session.user.id),
    getEnvironment(environmentId),
    getProductByEnvironmentId(environmentId),
  ]);

  if (!user) {
    throw new Error(t("common.user_not_found"));
  }

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }
  const currentUserMembership = await getMembershipByUserIdOrganizationId(
    session?.user.id,
    product.organizationId
  );
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);
  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;
  if (isReadOnly) {
    return redirect(`/environments/${environment.id}/surveys`);
  }

  const prefilledFilters = [product.config.channel, product.config.industry, searchParams.role ?? null];

  return (
    <TemplateContainerWithPreview
      environmentId={environmentId}
      user={user}
      environment={environment}
      product={product}
      prefilledFilters={prefilledFilters}
      // AI Survey Creation -- Need improvement
      isAIEnabled={false}
    />
  );
};

export default Page;
