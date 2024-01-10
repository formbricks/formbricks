import { ArrowDownIcon, CheckIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
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
      icon: ArrowDownIcon,
      color: "slate",
      title: "Connect Formbricks to your app.",
      subtitle: "You have not yet connected Formbricks to your app. Follow setup guide.",
    },
    running: {
      icon: CheckIcon,
      color: "green",
      title: "Receiving data.",
      subtitle: "You have successfully connected Formbricks to your app.",
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
        <p className="text-sm text-slate-700">{currentStatus.subtitle}</p>
      </div>
    );
  }
  if (type === "mini") {
    return (
      <Link href={`/environments/${environment.id}/settings/setup`}>
        <div className="group my-4 flex justify-center">
          <div className=" flex rounded-full bg-slate-100 px-2 py-1">
            <p className="mr-2 text-sm text-slate-400 group-hover:underline">{currentStatus.subtitle}</p>
            <div
              className={clsx(
                "h-5 w-5 rounded-full p-0.5",
                status === "notImplemented" && "bg-slate-100 text-slate-700",
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
