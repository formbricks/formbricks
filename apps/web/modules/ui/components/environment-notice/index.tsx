import Link from "next/link";
import { WEBAPP_URL } from "@/lib/constants";
import { getEnvironment, getEnvironments } from "@/lib/environment/service";
import { getTranslate } from "@/lingodotdev/server";
import { Alert, AlertButton, AlertTitle } from "@/modules/ui/components/alert";

interface EnvironmentNoticeProps {
  environmentId: string;
  subPageUrl: string;
}

export const EnvironmentNotice = async ({ environmentId, subPageUrl }: EnvironmentNoticeProps) => {
  const [t, environment] = await Promise.all([getTranslate(), getEnvironment(environmentId)]);

  if (!environment) {
    throw new Error("Environment not found");
  }

  const environments = await getEnvironments(environment.projectId);
  const otherEnvironment = environments.find(
    (candidateEnvironment) => candidateEnvironment.id !== environment.id
  );

  if (!otherEnvironment) {
    throw new Error("Other environment not found");
  }

  const currentEnvironmentLabel = t(
    environment.type === "production" ? "common.production" : "common.development"
  );
  const targetEnvironmentLabel = t(
    otherEnvironment.type === "production" ? "common.production" : "common.development"
  );

  return (
    <div>
      <Alert variant="info" size="small" className="max-w-4xl">
        <AlertTitle>{t("common.environment_notice", { environment: currentEnvironmentLabel })}</AlertTitle>
        <AlertButton>
          <Link
            href={`${WEBAPP_URL}/environments/${otherEnvironment.id}${subPageUrl}`}
            className="ml-1 cursor-pointer underline">
            {t("common.switch_to", {
              environment: targetEnvironmentLabel,
            })}
          </Link>
        </AlertButton>
      </Alert>
    </div>
  );
};
