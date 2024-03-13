import clsx from "clsx";
import { AlertTriangleIcon, CheckIcon } from "lucide-react";
import Link from "next/link";

import { getEnvironment } from "@formbricks/lib/environment/service";

interface WidgetStatusIndicatorProps {
  environmentId: string;
  type: "large" | "mini";
}

export default async function WidgetStatusIndicator({ environmentId, type }: WidgetStatusIndicatorProps) {
  const environment = await getEnvironment(environmentId);

  if (!environment) {
    throw new Error("Environment not found");
  }

  const stati = {
    notImplemented: {
      icon: AlertTriangleIcon,
      title: "Connect Formbricks to your app or website.",
      subtitle:
        "Your app or website is not yet connected with Formbricks. To run in-app surveys follow the setup guide.",
    },
    running: {
      icon: CheckIcon,
      title: "Receiving data.",
      subtitle: "Your app or website is connected with Formbricks.",
    },
  };

  let status: "notImplemented" | "running" | "issue";

  if (environment.widgetSetupCompleted) {
    status = "running";
  } else {
    status = "notImplemented";
  }

  const currentStatus = stati[status];

  if (type === "large") {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center space-y-2 rounded-lg py-6 text-center",
          status === "notImplemented" && "bg-slate-100",
          status === "running" && "bg-green-100"
        )}>
        <div
          className={clsx(
            "h-12 w-12 rounded-full bg-white p-2",
            status === "notImplemented" && "text-slate-700",
            status === "running" && "text-green-700"
          )}>
          <currentStatus.icon />
        </div>
        <p className="text-md font-bold text-slate-800 md:text-xl">{currentStatus.title}</p>
        <p className="w-2/3 text-balance text-sm text-slate-600">{currentStatus.subtitle}</p>
      </div>
    );
  }
  if (type === "mini") {
    return (
      <Link href={`/environments/${environment.id}/settings/setup`}>
        <div className="group my-4 flex justify-center">
          <div className=" flex rounded-full bg-slate-100 px-2 py-1">
            <p className="mr-2 text-sm text-slate-500 group-hover:underline">{currentStatus.subtitle}</p>
            <div
              className={clsx(
                "h-5 w-5 rounded-full",
                status === "notImplemented" && "border border-white bg-white text-amber-600",
                status === "running" && "bg-green-100 text-green-700"
              )}>
              <currentStatus.icon />
            </div>
          </div>
        </div>
      </Link>
    );
  } else {
    return null;
  }
}
