import { AddWebhookButton } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/AddWebhookButton";
import { WebhookRowData } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookRowData";
import { WebhookTable } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookTable";
import { WebhookTableHeading } from "@/app/(app)/environments/[environmentId]/integrations/webhooks/components/WebhookTableHeading";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@formbricks/lib/authOptions";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { getWebhooks } from "@formbricks/lib/webhook/service";
import { GoBackButton } from "@formbricks/ui/components/GoBackButton";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslations();
  const [session, organization, webhooksUnsorted, surveys, environment] = await Promise.all([
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
    getWebhooks(params.environmentId),
    getSurveys(params.environmentId, 200), // HOTFIX: not getting all surveys for now since it's maxing out the prisma accelerate limit
    getEnvironment(params.environmentId),
  ]);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session?.user.id, environment?.productId);

  const { hasReadAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && hasReadAccess;

  const webhooks = webhooksUnsorted.sort((a, b) => {
    if (a.createdAt > b.createdAt) return -1;
    if (a.createdAt < b.createdAt) return 1;
    return 0;
  });

  const renderAddWebhookButton = () => <AddWebhookButton environment={environment} surveys={surveys} />;
  const locale = await await findMatchingLocale();

  return (
    <PageContentWrapper>
      <GoBackButton />
      <PageHeader pageTitle={t("common.webhooks")} cta={!isReadOnly ? renderAddWebhookButton() : <></>} />
      <WebhookTable environment={environment} webhooks={webhooks} surveys={surveys} isReadOnly={isReadOnly}>
        <WebhookTableHeading />
        {webhooks.map((webhook) => (
          <WebhookRowData key={webhook.id} webhook={webhook} surveys={surveys} locale={locale} />
        ))}
      </WebhookTable>
    </PageContentWrapper>
  );
};

export default Page;
