import { AuthenticationError } from "@formbricks/types/errors";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getUser } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { AuthorizedAppsList } from "@/modules/mcp/authorized-apps/components/authorized-apps-list";
import { Button } from "@/modules/ui/components/button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { AuthorizedAppsQueryClientProvider } from "./query-client-provider";

/**
 * Authorized apps: the user's MCP clients, each with its grant, Edit and Revoke. The list is read and
 * edited client-side through `/api/internal/mcp-grants` (ENG-7152); this page only checks the session.
 */
const Page = async () => {
  const t = await getTranslate();
  const session = await getSession();
  if (!session?.user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const user = await getUser(session.user.id);
  if (!user) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.authorized_apps")} />
      <SettingsCard
        title={t("auth.oauth.authorized_apps_title")}
        description={t("auth.oauth.authorized_apps_description")}
        cta={
          <Button asChild variant="secondary" size="sm">
            <a
              href="https://formbricks.com/docs/platform/mcp/overview"
              target="_blank"
              rel="noopener noreferrer">
              {t("auth.oauth.mcp_docs_link")}
            </a>
          </Button>
        }>
        <AuthorizedAppsQueryClientProvider>
          <AuthorizedAppsList locale={user.locale} />
        </AuthorizedAppsQueryClientProvider>
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;
