import { LightbulbIcon } from "lucide-react";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";

interface EnvironmentNoticeProps {
  environmentId: string;
  subPageUrl: string;
}

export const EnvironmentNotice = async ({ environmentId, subPageUrl }: EnvironmentNoticeProps) => {
  const environment = await getEnvironment(environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }

  const environments = await getEnvironments(environment.productId);
  const otherEnvironmentId = environments.filter((e) => e.id !== environment.id)[0].id;

  return (
    <div className="mt-4 flex max-w-4xl items-center space-y-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base">
      <LightbulbIcon className="mr-3 h-4 w-4 text-blue-400" />
      <p className="text-sm">
        {`You're currently in the ${environment.type} environment.`}
        <a
          href={`${WEBAPP_URL}/environments/${otherEnvironmentId}${subPageUrl}`}
          className="ml-1 cursor-pointer text-sm underline">
          Switch to {environment.type === "production" ? "Development" : "Production"} now.
        </a>
      </p>
    </div>
  );
};
