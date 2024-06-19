import clsx from "clsx";
import { AlertTriangleIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { TEnvironment } from "@formbricks/types/environment";
import { Label } from "@formbricks/ui/Label";

interface WidgetStatusIndicatorProps {
  environment: TEnvironment;
  size: "large" | "mini";
  type: "app" | "website";
}

export const WidgetStatusIndicator = ({ environment, size, type }: WidgetStatusIndicatorProps) => {
  const stati = {
    notImplemented: {
      icon: AlertTriangleIcon,
      title: `Your ${type} is not yet connected.`,
      subtitle: `Connect your ${type} with Formbricks to get started. To run ${type === "app" ? "in-app" : "website"} surveys follow the setup guide.`,
      shortText: `Connect your ${type} with Formbricks`,
    },
    running: {
      icon: CheckIcon,
      title: "Receiving data 💃🕺",
      subtitle: `Your ${type} is connected with Formbricks.`,
      shortText: `${type === "app" ? "App" : "Website"} connected`,
    },
  };

  const setupStatus = type === "app" ? environment.appSetupCompleted : environment.websiteSetupCompleted;
  let status: "notImplemented" | "running" | "issue";

  if (setupStatus) {
    status = "running";
  } else {
    status = "notImplemented";
  }

  const currentStatus = stati[status];

  if (size === "large") {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center space-y-2 rounded-lg border py-6 text-center",
          status === "notImplemented" && "border-slate-200 bg-slate-100",
          status === "running" && "border-emerald-200 bg-emerald-100"
        )}>
        <div
          className={clsx(
            "flex h-12 w-12 items-center justify-center rounded-full border bg-white p-2",
            status === "notImplemented" && "border-slate-200 text-slate-700",
            status === "running" && "border-emerald-200 text-emerald-700"
          )}>
          <currentStatus.icon />
        </div>
        <p className="text-md font-bold text-slate-800 md:text-xl">{currentStatus.title}</p>
        <p className="w-2/3 text-balance text-sm text-slate-600">{currentStatus.subtitle}</p>
      </div>
    );
  }
  if (size === "mini") {
    return (
      <div className="flex gap-2">
        <Link href={`/environments/${environment.id}/product/${type}-connection`}>
          <div className="group flex justify-center">
            <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
              {status === "running" ? (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                </span>
              ) : (
                <AlertTriangleIcon className="h-[14px] w-[14px] text-amber-600" />
              )}
              <Label className="group-hover:cursor-pointer group-hover:underline">
                {currentStatus.shortText}
              </Label>
            </div>
          </div>
        </Link>
      </div>
    );
  } else {
    return null;
  }
};
