"use server";

import { getActionClasses } from "@/lib/actionClass/service";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getEnvironments } from "@/lib/environment/service";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ActionSettingsCard } from "@/modules/projects/settings/(setup)/components/action-settings-card";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();
  const { environmentId } = params;

  const { environment, isReadOnly, session } = await getEnvironmentAuth(environmentId);

  const [environments, actionClasses, locale] = await Promise.all([
    getEnvironments(environment.projectId),
    getActionClasses(environmentId),
    getUserLocale(session.user.id),
  ]);
  const otherEnvironment = environments.filter((env) => env.id !== environmentId)[0];
  const otherEnvActionClasses = otherEnvironment ? await getActionClasses(otherEnvironment.id) : [];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.actions")} />
      <ActionSettingsCard
        environment={environment}
        otherEnvironment={otherEnvironment}
        otherEnvActionClasses={otherEnvActionClasses}
        environmentId={environmentId}
        actionClasses={actionClasses}
        isReadOnly={isReadOnly}
        locale={locale ?? DEFAULT_LOCALE}
      />
    </PageContentWrapper>
  );
};

export default Page;
