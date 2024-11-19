import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { EditLogo } from "@/app/(app)/environments/[environmentId]/product/look/components/EditLogo";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import {
  getMultiLanguagePermission,
  getRemoveInAppBrandingPermission,
  getRemoveLinkBrandingPermission,
  getRoleManagementPermission,
} from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { cn } from "@formbricks/lib/cn";
import { DEFAULT_LOCALE, SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUserLocale } from "@formbricks/lib/user/service";
import { Alert, AlertDescription } from "@formbricks/ui/components/Alert";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { SettingsCard } from "../../settings/components/SettingsCard";
import { EditFormbricksBranding } from "./components/EditBranding";
import { EditPlacementForm } from "./components/EditPlacementForm";
import { ThemeStyling } from "./components/ThemeStyling";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslations();
  const [session, organization, product] = await Promise.all([
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error(t("common.product_not_found"));
  }
  if (!session) {
    throw new Error(t("common.session_not_found"));
  }
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }
  const locale = session?.user.id ? await getUserLocale(session.user.id) : undefined;
  const canRemoveInAppBranding = getRemoveInAppBrandingPermission(organization);
  const canRemoveLinkBranding = getRemoveLinkBrandingPermission(organization);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isMember } = getAccessFlags(currentUserMembership?.role);

  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);
  const { hasManageAccess } = getTeamPermissionFlags(productPermission);

  const isReadOnly = isMember && !hasManageAccess;

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const canDoRoleManagement = await getRoleManagementPermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.configuration")}>
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="look"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          canDoRoleManagement={canDoRoleManagement}
        />
      </PageHeader>
      <SettingsCard
        title={t("environments.product.look.theme")}
        className={cn(!isReadOnly && "max-w-7xl")}
        description={t("environments.product.look.theme_settings_description")}>
        <ThemeStyling
          environmentId={params.environmentId}
          product={product}
          colors={SURVEY_BG_COLORS}
          isUnsplashConfigured={UNSPLASH_ACCESS_KEY ? true : false}
          locale={locale ?? DEFAULT_LOCALE}
          isReadOnly={isReadOnly}
        />
      </SettingsCard>
      <SettingsCard
        title={t("common.logo")}
        description={t("environments.product.look.logo_settings_description")}>
        <EditLogo product={product} environmentId={params.environmentId} isReadOnly={isReadOnly} />
      </SettingsCard>
      <SettingsCard
        title={t("environments.product.look.app_survey_placement")}
        description={t("environments.product.look.app_survey_placement_settings_description")}>
        <EditPlacementForm product={product} environmentId={params.environmentId} isReadOnly={isReadOnly} />
      </SettingsCard>
      <SettingsCard
        title={t("environments.product.look.formbricks_branding")}
        description={t("environments.product.look.formbricks_branding_settings_description")}>
        <div className="space-y-4">
          <EditFormbricksBranding
            type="linkSurvey"
            product={product}
            canRemoveBranding={canRemoveLinkBranding}
            environmentId={params.environmentId}
            isReadOnly={isReadOnly}
          />
          <EditFormbricksBranding
            type="appSurvey"
            product={product}
            canRemoveBranding={canRemoveInAppBranding}
            environmentId={params.environmentId}
            isReadOnly={isReadOnly}
          />
        </div>

        {isReadOnly && (
          <Alert variant="warning" className="mt-4">
            <AlertDescription>
              {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
            </AlertDescription>
          </Alert>
        )}
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
