"use client";

import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEnvironment } from "@/lib/environments/environments";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
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
        <div className="flex items-center rounded-lg border border-amber-200 bg-amber-100 p-6 text-slate-900 shadow-sm">
          <ExclamationTriangleIcon className="mr-3 h-6 w-6 text-amber-400" />
          You&apos;re currently in the Production environment.
          <a
            onClick={() => changeEnvironment("development")}
            className="ml-1 cursor-pointer font-medium underline">
            Set up Development environment?
          </a>
        </div>
      )}
    </div>
  );
}
