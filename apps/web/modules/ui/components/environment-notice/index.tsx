import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getEnvironment } from "@/lib/environment/service";
import { getTranslate } from "@/lingodotdev/server";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";

interface EnvironmentNoticeProps {
  environmentId: string;
  subPageUrl: string;
}

export const EnvironmentNotice = async ({ environmentId }: EnvironmentNoticeProps) => {
  const [t, environment] = await Promise.all([getTranslate(), getEnvironment(environmentId)]);

  if (!environment) {
    throw new ResourceNotFoundError(t("common.environment"), environmentId);
  }

  return (
    <div>
      <Alert variant="info" size="small" className="max-w-4xl">
        <AlertTitle>{t("common.environment_notice", { environment: t("common.production") })}</AlertTitle>
      </Alert>
    </div>
  );
};
