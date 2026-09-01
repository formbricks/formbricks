import Link from "next/link";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { assertCan } from "@/lib/authorization";
import { withAuthorizationSurface } from "@/lib/authorization/context";
import { DEFAULT_LOCALE, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getWorkspacesByOrganizationId } from "@/modules/organization/settings/api-keys/lib/workspaces";
import { redirectBillingRoleFromRestrictedOrgSettings } from "@/modules/settings/lib/redirect-billing-role";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { ApiKeyList } from "./components/api-key-list";

export const APIKeysPage = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const params = await props.params;
  const t = await getTranslate();

  await redirectBillingRoleFromRestrictedOrgSettings(params.organizationId);

  const { organization, session } = await getOrganizationAuth(params.organizationId);

  // ENG-2409: was `currentUserMembership.role === "owner" || "manager"` followed by a bare
  // `throw new Error(...)`. `organization.manage_api_keys` is the same set, and it is the exact
  // question `createApiKeyAction` already asks — so the page and the mutation behind it cannot drift
  // if that permission is ever split from `organization.manage`.
  //
  // Two deliberate changes beyond the routing:
  //   - `assertCan` throws `AuthorizationError`, which is in EXPECTED_ERROR_NAMES. The bare `Error`
  //     was not, so every unauthorized load of this page was being reported to Sentry as an
  //     unexpected exception. `app/error.tsx` renders both identically, so nothing user-visible moves.
  //   - The gate now runs BEFORE the workspace/locale fetch below rather than after it. Authorizing
  //     after reading the data it protects was harmless here (nothing was rendered) but is the wrong
  //     order to leave in place.
  await withAuthorizationSurface("page", () =>
    assertCan({ type: "user", id: session.user.id }, "organization.manage_api_keys", {
      type: "organization",
      id: organization.id,
    })
  );

  const [workspaces, locale] = await Promise.all([
    getWorkspacesByOrganizationId(organization.id),
    getUserLocale(session.user.id),
  ]);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.api_keys")} />
      {workspaces.length > 0 && (
        <Alert variant="info" role="status" className="max-w-4xl rounded-xl">
          <AlertTitle>{t("workspace.settings.api_keys.connect_app_banner_title")}</AlertTitle>
          <AlertDescription>
            {t("workspace.settings.api_keys.connect_app_banner_description")}
          </AlertDescription>
          <AlertButton asChild>
            <Link href={`/workspaces/${workspaces[0].id}/settings/workspace/app-connection`}>
              {t("workspace.settings.api_keys.connect_app_banner_link")}
            </Link>
          </AlertButton>
        </Alert>
      )}
      <SettingsCard
        title={t("common.api_keys")}
        description={t("workspace.settings.api_keys.api_keys_description")}
        bodyVariant="flush">
        <ApiKeyList
          organizationId={organization.id}
          locale={locale ?? DEFAULT_LOCALE}
          workspaces={workspaces}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};
