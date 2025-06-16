import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import { PlainWrapper } from "@/app/(app)/environments/[environmentId]/integrations/plain/components/PlainWrapper";
import { WEBAPP_URL } from "@/lib/constants";
import { getIntegrationByType } from "@/lib/integration/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { redirect } from "next/navigation";
import { TIntegrationPlain } from "@formbricks/types/integration/plain";

const Page = async (props) => {
  const params = await props.params;
  const t = await getTranslate();
  const enabled = true; // Plain integration is always enabled

  const { isReadOnly, environment } = await getEnvironmentAuth(params.environmentId);

  const [surveys, plainIntegration] = await Promise.all([
    getSurveys(params.environmentId),
    getIntegrationByType(params.environmentId, "plain"),
  ]);

  // Plain integration doesn't need databases like Notion does
  const databasesArray = [];
  const locale = await findMatchingLocale();

  if (isReadOnly) {
    redirect("./");
  }

  return (
    <PageContentWrapper>
      <GoBackButton url={`${WEBAPP_URL}/environments/${params.environmentId}/integrations`} />
      <PageHeader pageTitle={t("environments.integrations.plain.plain_integration") || "Plain Integration"} />
      <PlainWrapper
        enabled={enabled}
        surveys={surveys}
        environment={environment}
        plainIntegration={plainIntegration as TIntegrationPlain}
        webAppUrl={WEBAPP_URL}
        databasesArray={databasesArray}
        locale={locale}
      />
    </PageContentWrapper>
  );
};

export default Page;
