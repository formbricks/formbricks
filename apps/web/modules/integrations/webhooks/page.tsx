import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { AddWebhookButton } from "@/modules/integrations/webhooks/components/add-webhook-button";
import { WebhookRowData } from "@/modules/integrations/webhooks/components/webhook-row-data";
import { WebhookTable } from "@/modules/integrations/webhooks/components/webhook-table";
import { WebhookTableHeading } from "@/modules/integrations/webhooks/components/webhook-table-heading";
import { getWebhooks } from "@/modules/integrations/webhooks/lib/webhook";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";

export const WebhooksPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const [session, organization, webhooks, surveys, environment] = await Promise.all([
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

  const projectPermission = await getProjectPermissionByUserId(session?.user.id, environment?.projectId);

  const { hasReadAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;

  const renderAddWebhookButton = () => <AddWebhookButton environment={environment} surveys={surveys} />;
  const locale = await findMatchingLocale();

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
