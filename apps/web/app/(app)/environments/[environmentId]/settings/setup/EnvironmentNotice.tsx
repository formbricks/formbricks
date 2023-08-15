"use client";

import { TEnvironment } from "@formbricks/types/v1/environment";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";

export default function EnvironmentNotice({
  environment,
  environments,
}: {
  environment: TEnvironment;
  environments: TEnvironment[];
}) {
  const router = useRouter();

  const changeEnvironment = (environmentType: string) => {
    const newEnvironmentId = environments.find((e) => e.type === environmentType)?.id;
    router.push(`/environments/${newEnvironmentId}/`);
  };

  return (
    <div>
      {environment.type === "production" && !environment.widgetSetupCompleted && (
        <div className="flex items-center rounded-lg border border-amber-100 bg-amber-50 p-4 text-slate-900 shadow-sm">
          <ExclamationTriangleIcon className="mr-3 h-6 w-6 text-amber-700" />
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
