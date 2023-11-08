import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { LightBulbIcon } from "@heroicons/react/24/outline";

interface EnvironmentNoticeProps {
  environmentId: string;
}

export default async function EnvironmentNotice({ environmentId }: EnvironmentNoticeProps) {
  const environment = await getEnvironment(environmentId);
  const environments = await getEnvironments(environment.productId);
  const otherEnvironmentId = environments.filter((e) => e.id !== environment.id)[0].id;

  return (
    <div>
      <div className="flex items-center space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base">
        <LightBulbIcon className="mr-3 h-4 w-4 text-blue-400" />
        <p>
          {`You're currently in the ${environment.type} environment.`}
          <a
            href={`${WEBAPP_URL}/environments/${otherEnvironmentId}/settings/api-keys`}
            className="ml-1 cursor-pointer text-sm underline">
            Switch to {environment.type === "production" ? "Development" : "Production"} now.
          </a>
        </p>
      </div>
    </div>
  );
}
