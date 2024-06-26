import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { EditLogo } from "@/app/(app)/environments/[environmentId]/product/look/components/EditLogo";
import { getServerSession } from "next-auth";
import {
  getMultiLanguagePermission,
  getRemoveInAppBrandingPermission,
  getRemoveLinkBrandingPermission,
} from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { SURVEY_BG_COLORS, UNSPLASH_ACCESS_KEY } from "@formbricks/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
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

  const canRemoveInAppBranding = getRemoveInAppBrandingPermission(organization);
  const canRemoveLinkBranding = getRemoveLinkBrandingPermission(organization);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isViewer } = getAccessFlags(currentUserMembership?.role);

  if (isViewer) {
    return <ErrorComponent />;
  }

  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);
  const currentProductChannel = product?.config.channel ?? null;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation
          environmentId={params.environmentId}
          activeId="look"
          isMultiLanguageAllowed={isMultiLanguageAllowed}
          productChannel={currentProductChannel}
        />
      </PageHeader>
      <SettingsCard
        title="Theme"
        className="max-w-7xl"
        description="Create a style theme for all surveys. You can enable custom styling for each survey.">
        <ThemeStyling
          environmentId={params.environmentId}
          product={product}
          colors={SURVEY_BG_COLORS}
          isUnsplashConfigured={UNSPLASH_ACCESS_KEY ? true : false}
        />
      </SettingsCard>
      <SettingsCard title="Logo" description="Upload your company logo to brand surveys and link previews.">
        <EditLogo product={product} environmentId={params.environmentId} isViewer={isViewer} />
      </SettingsCard>
      {currentProductChannel !== "link" && (
        <SettingsCard
          title="In-app Survey Placement"
          description="Change where surveys will be shown in your web app.">
          <EditPlacementForm product={product} environmentId={params.environmentId} />
        </SettingsCard>
      )}
      <SettingsCard
        title="Formbricks Branding"
        description="We love your support but understand if you toggle it off.">
        <div className="space-y-4">
          <EditFormbricksBranding
            type="linkSurvey"
            product={product}
            canRemoveBranding={canRemoveLinkBranding}
            environmentId={params.environmentId}
          />
          {currentProductChannel !== "link" && (
            <EditFormbricksBranding
              type="inAppSurvey"
              product={product}
              canRemoveBranding={canRemoveInAppBranding}
              environmentId={params.environmentId}
            />
          )}
        </div>
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
