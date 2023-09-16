"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEnvironment } from "@/lib/environments/environments";
import { ErrorComponent } from "@formbricks/ui";
import { LightBulbIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";

export default function EnvironmentNotice({ environmentId }: { environmentId: string }) {
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
