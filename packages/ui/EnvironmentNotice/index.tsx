import { getEnvironment, getEnvironments } from "@formbricks/lib/environment/service";
import { LightBulbIcon } from "@heroicons/react/24/outline";
import { headers } from "next/headers";

interface EnvironmentNoticeProps {
  environmentId: string;
}

export default async function EnvironmentNotice({ environmentId }: EnvironmentNoticeProps) {
  const headersList = headers();
  const currentUrl = headersList.get("referer") || "";
  const environment = await getEnvironment(environmentId);
  const environments = await getEnvironments(environment.productId);
  const otherEnvironmentId = environments.find((e) => e.id !== environment.id)?.id || "";

  const replaceEnvironmentId = (url: string, newId: string): string => {
    const regex = /environments\/([a-zA-Z0-9]+)/;
    if (regex.test(url)) {
      return url.replace(regex, `environments/${newId}`);
    }
    return url;
  };

  return (
    <div>
      <div className="flex items-center space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base">
        <LightBulbIcon className="mr-3 h-4 w-4 text-blue-400" />
        <p>
          {`You're currently in the ${environment.type} environment.`}
          <a
            href={replaceEnvironmentId(currentUrl, otherEnvironmentId)}
            className="ml-1 cursor-pointer text-sm underline">
            Switch to {environment.type === "production" ? "Development" : "Production"} now.
          </a>
        </p>
      </div>
    </div>
  );
}
