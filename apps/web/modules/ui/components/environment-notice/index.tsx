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
  const t = await getTranslate();
  const environment = await getEnvironment(environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }

  const environments = await getEnvironments(environment.projectId);
  const otherEnvironmentId = environments.filter((e) => e.id !== environment.id)[0].id;

  return (
    <div>
      <Alert variant="info" size="small" className="max-w-4xl">
        <AlertTitle>{t("common.environment_notice", { environment: environment.type })}</AlertTitle>
        <AlertButton>
          <Link
            href={`${WEBAPP_URL}/environments/${otherEnvironmentId}${subPageUrl}`}
            className="ml-1 cursor-pointer underline">
            {t("common.switch_to", {
              environment: environment.type === "production" ? "Development" : "Production",
            })}
          </Link>
        </AlertButton>
      </Alert>
    </div>
  );
};
