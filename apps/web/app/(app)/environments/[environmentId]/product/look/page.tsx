import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { EditLogo } from "@/app/(app)/environments/[environmentId]/product/look/components/EditLogo";
import { getServerSession } from "next-auth";
import {
  getMultiLanguagePermission,
  getRemoveInAppBrandingPermission,
  getRemoveLinkBrandingPermission,
} from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { DEFAULT_LOCALE, SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getUserLocale } from "@formbricks/lib/user/service";
import { ErrorComponent } from "@formbricks/ui/components/ErrorComponent";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { SettingsCard } from "../../settings/components/SettingsCard";
import { EditFormbricksBranding } from "./components/EditBranding";
import { EditPlacementForm } from "./components/EditPlacementForm";
import { ThemeStyling } from "./components/ThemeStyling";

const Page = async ({ params }: { params: { environmentId: string } }) => {
  const [session, organization, product] = await Promise.all([
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!organization) {
    throw new Error("Organization not found");
  }
  const locale = session?.user.id ? await getUserLocale(session.user.id) : undefined;
  const canRemoveInAppBranding = getRemoveInAppBrandingPermission(organization);
  const canRemoveLinkBranding = getRemoveLinkBrandingPermission(organization);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  if (isViewer) {
    return <ErrorComponent />;
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="common.configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="look"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
        />
      </PageHeader>
      <SettingsCard
        title="environments.product.look.theme"
        className="max-w-7xl"
        description="environments.product.look.theme_settings_description">
        <ThemeStyling
          environmentId={params.environmentId}
          product={product}
          colors={SURVEY_BG_COLORS}
          isUnsplashConfigured={UNSPLASH_ACCESS_KEY ? true : false}
          locale={locale ?? DEFAULT_LOCALE}
        />
      </SettingsCard>
      <SettingsCard title="common.logo" description="environments.product.look.logo_settings_description">
        <EditLogo product={product} environmentId={params.environmentId} isViewer={isViewer} />
      </SettingsCard>
      <SettingsCard
        title="environments.product.look.app_survey_placement"
        description="environments.product.look.app_survey_placement_settings_description">
        <EditPlacementForm product={product} environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard
        title="environments.product.look.formbricks_branding"
        description="environments.product.look.formbricks_branding_settings_description">
        <div className="space-y-4">
          <EditFormbricksBranding
            type="linkSurvey"
            product={product}
            canRemoveBranding={canRemoveLinkBranding}
            environmentId={params.environmentId}
          />
          <EditFormbricksBranding
            type="appSurvey"
            product={product}
            canRemoveBranding={canRemoveInAppBranding}
            environmentId={params.environmentId}
          />
        </div>
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
