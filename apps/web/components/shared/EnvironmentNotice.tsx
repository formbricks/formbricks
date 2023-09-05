"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEnvironment } from "@/lib/environments/environments";
import { ErrorComponent } from "@formbricks/ui";
import { LightBulbIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";

export default function EnvironmentNotice({
  environmentId,
  pageType,
}: {
  environmentId: string;
  pageType: string;
}) {
  const { environment, isErrorEnvironment, isLoadingEnvironment } = useEnvironment(environmentId);
  const router = useRouter();

  const changeEnvironment = (environmentType: string) => {
    const newEnvironmentId = environment.product.environments.find((e) => e.type === environmentType)?.id;
    router.push(`/environments/${newEnvironmentId}/`);
  };

  if (isLoadingEnvironment) {
    return <LoadingSpinner />;
  }

  if (isErrorEnvironment) {
    return <ErrorComponent />;
  }
  if (pageType === "apiSettings") {
    return (
      <div>
        <div className="flex items-center space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base">
          <LightBulbIcon className="mr-3 h-8 w-8 text-blue-400" />
          <p>
            {environment.type === "production"
              ? "You're currently in the production environment, so you can only create production API keys. "
              : "You're currently in the development environment, so you can only create development API keys. "}
            <a
              onClick={() =>
                changeEnvironment(environment.type === "production" ? "development" : "production")
              }
              className="ml-1 cursor-pointer underline">
              Switch to {environment.type === "production" ? "Development" : "Production"} now.
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (pageType === "setupChecklist")
    return (
      <div>
        {environment.type === "production" && !environment.widgetSetupCompleted && (
          <div className="flex items-center space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base">
            <LightBulbIcon className="mr-3 h-6 w-6 text-blue-400" />
            <p>
              You&apos;re currently in the Production environment.
              <a onClick={() => changeEnvironment("development")} className="ml-1 cursor-pointer underline">
                Switch to Development environment.
              </a>
            </p>
          </div>
        )}
      </div>
    );
}
