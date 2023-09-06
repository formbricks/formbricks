import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironments } from "@formbricks/lib/services/environment";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { LightBulbIcon } from "@heroicons/react/24/solid";

interface EnvironmentNoticeProps {
  environment: TEnvironment;
}

export default async function EnvironmentNotice({ environment }: EnvironmentNoticeProps) {
  const environments = await getEnvironments(environment.productId);
  const otherEnvironmentId = environments.find((e) => e.id !== environment.id)?.id;

  return (
    <div>
      <div className="flex items-center space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base">
        <LightBulbIcon className="mr-3 h-8 w-8 text-blue-400" />
        <p>
          {environment.type === "production"
            ? "You're currently in the production environment, so you can only create production API keys. "
            : "You're currently in the development environment, so you can only create development API keys. "}
          <a
            href={`${WEBAPP_URL}/environments/${otherEnvironmentId}`}
            className="ml-1 cursor-pointer underline">
            Switch to {environment.type === "production" ? "Development" : "Production"} now.
          </a>
        </p>
      </div>
    </div>
  );
}
