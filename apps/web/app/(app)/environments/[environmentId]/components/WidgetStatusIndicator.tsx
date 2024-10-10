import { AlertTriangleIcon, CheckIcon } from "lucide-react";
import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";

interface WidgetStatusIndicatorProps {
  environment: TEnvironment;
}

export const WidgetStatusIndicator = ({ environment }: WidgetStatusIndicatorProps) => {
  const stati = {
    notImplemented: {
      icon: AlertTriangleIcon,
      title: `Formbricks SDK is not yet connected.`,
      subtitle: `Connect your website or app with Formbricks`,
    },
    running: {
      icon: CheckIcon,
      title: "Receiving data 💃🕺",
      subtitle: `Formbricks SDK is connected`,
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
    </div>
  );
};
