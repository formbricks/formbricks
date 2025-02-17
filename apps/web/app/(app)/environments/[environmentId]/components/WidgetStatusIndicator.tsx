"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { AlertTriangleIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";

interface WidgetStatusIndicatorProps {
  environment: TEnvironment;
}

export const WidgetStatusIndicator = ({ environment }: WidgetStatusIndicatorProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const stati = {
    notImplemented: {
      icon: AlertTriangleIcon,
      title: t("environments.project.app-connection.formbricks_sdk_not_connected"),
      subtitle: t("environments.project.app-connection.formbricks_sdk_not_connected_description"),
    },
    running: {
      icon: CheckIcon,
      title: t("environments.project.app-connection.receiving_data"),
      subtitle: t("environments.project.app-connection.formbricks_sdk_connected"),
    },
  };

  let status: "notImplemented" | "running";

  if (environment.appSetupCompleted) {
    status = "running";
  } else {
    status = "notImplemented";
  }

  const currentStatus: { icon: React.ExoticComponent; title: string; subtitle: string } = stati[status];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center space-y-2 rounded-lg border py-6 text-center",
        status === "notImplemented" && "border-slate-200 bg-slate-100",
        status === "running" && "border-emerald-200 bg-emerald-100"
      )}>
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border bg-white p-2",
          status === "notImplemented" && "border-slate-200 text-slate-700",
          status === "running" && "border-emerald-200 text-emerald-700"
        )}>
        <currentStatus.icon />
      </div>
      <p className="text-md font-bold text-slate-800 md:text-xl">{currentStatus.title}</p>
      <p className="w-2/3 text-balance text-sm text-slate-600">{currentStatus.subtitle}</p>
      {status === "notImplemented" && (
        <Button variant="outline" size="sm" className="bg-white" onClick={() => router.refresh()}>
          <RotateCcwIcon />
          {t("environments.project.app-connection.recheck")}
        </Button>
      )}
    </div>
  );
};
