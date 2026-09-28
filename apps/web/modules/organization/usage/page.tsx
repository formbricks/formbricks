import { notFound } from "next/navigation";
import { can } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UsageView } from "./components/usage-view";

/**
 * Organization usage (ENG-3316, ENG-3327): self-hosted only, Owners and Managers only. Everyone else gets
 * a 404, like the Enterprise License page — a member has nowhere better to land. The numbers load on the
 * client from the internal usage route, which repeats this check, because the range picker refetches
 * without a navigation (ENG-3328).
 */
export const UsagePage = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const params = await props.params;

  if (IS_FORMBRICKS_CLOUD) {
    return notFound();
  }

  const [t, { session, organization }] = await Promise.all([
    getTranslate(),
    getOrganizationAuth(params.organizationId),
  ]);

  const canManageOrganization = await withAuthorizationSurface("page", () =>
    can({ type: "user", id: session.user.id }, "organization.manage", {
      type: "organization",
      id: organization.id,
    })
  );

  if (!canManageOrganization) {
    return notFound();
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.settings.usage.nav_label")} />
      <UsageView organizationId={organization.id} />
    </PageContentWrapper>
  );
};
