import { redirect } from "next/navigation";
import { TIntegrationGoogleSheets } from "@formbricks/types/integration/google-sheet";
import { GoogleSheetWrapper } from "@/app/(app)/workspaces/[workspaceId]/(workspace)/integrations/google-sheets/components/GoogleSheetWrapper";
import { getSurveys } from "@/app/(app)/workspaces/[workspaceId]/(workspace)/integrations/lib/surveys";
import {
  DEFAULT_LOCALE,
  GOOGLE_SHEETS_CLIENT_ID,
  GOOGLE_SHEETS_CLIENT_SECRET,
  GOOGLE_SHEETS_REDIRECT_URL,
  WEBAPP_URL,
} from "@/lib/constants";
import { getIntegrations } from "@/lib/integration/service";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const Page = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();
  const isEnabled = !!(GOOGLE_SHEETS_CLIENT_ID && GOOGLE_SHEETS_CLIENT_SECRET && GOOGLE_SHEETS_REDIRECT_URL);

  const { isReadOnly, session, workspace } = await getWorkspaceAuth(params.workspaceId);

  const [surveys, integrations, locale] = await Promise.all([
    getSurveys(workspace.id),
    getIntegrations(workspace.id),
    getUserLocale(session.user.id),
  ]);

  const googleSheetIntegration: TIntegrationGoogleSheets | undefined = integrations?.find(
    (integration): integration is TIntegrationGoogleSheets => integration.type === "googleSheets"
  );
  if (isReadOnly) {
    return redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/workspaces/${params.workspaceId}/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.google_sheets.google_sheets_integration")} />
      <div className="h-[75vh] w-full">
        <GoogleSheetWrapper
          isEnabled={isEnabled}
          workspaceId={workspace.id}
          surveys={surveys}
          googleSheetIntegration={googleSheetIntegration}
          webAppUrl={WEBAPP_URL}
          locale={locale ?? DEFAULT_LOCALE}
        />
      </div>
    </PageContentWrapper>
  );
};

export default Page;
