"use client";

import { AlertTriangleIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";

interface WidgetStatusIndicatorProps {
  workspace: { appSetupCompleted: boolean };
}

export const WidgetStatusIndicator = ({ workspace }: WidgetStatusIndicatorProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const stati = {
    notImplemented: {
      icon: AlertTriangleIcon,
      title: t("workspace.app-connection.formbricks_sdk_not_connected"),
      subtitle: t("workspace.app-connection.formbricks_sdk_not_connected_description"),
    },
    running: {
      icon: CheckIcon,
      title: t("workspace.app-connection.receiving_data"),
      subtitle: t("workspace.app-connection.formbricks_sdk_connected"),
    },
  };

  let status: "notImplemented" | "running";

  if (workspace.appSetupCompleted) {
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
          {t("workspace.app-connection.recheck")}
        </Button>
      )}
    </div>
  );
};
