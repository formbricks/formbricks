"use client";

import { timeSince } from "@formbricks/lib/time";
import { TAction } from "@formbricks/types/v1/actions";
import { TEnvironment, TEnvironmentUpdateInput } from "@formbricks/types/v1/environment";
import { Confetti } from "@formbricks/ui";
import { ArrowDownIcon, CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface WidgetStatusIndicatorProps {
  environment: TEnvironment;
  type: "large" | "mini";
  actions: TAction[];
  updateEnvironmentAction: (
    environmentId: string,
    data: Partial<TEnvironmentUpdateInput>
  ) => Promise<TEnvironment>;
}

export default function WidgetStatusIndicator({
  environment,
  type,
  actions,
  updateEnvironmentAction,
}: WidgetStatusIndicatorProps) {
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (!environment?.widgetSetupCompleted && actions && actions.length > 0) {
      updateEnvironmentAction(environment.id, { widgetSetupCompleted: true });
    }
  }, [environment, actions]);

  const stati = {
    notImplemented: {
      icon: ArrowDownIcon,
      color: "slate",
      title: "Connect Formbricks to your app.",
      subtitle: "You have not yet connected Formbricks to your app. Follow setup guide.",
    },
    running: { icon: CheckIcon, color: "green", title: "Receiving data.", subtitle: "Last action received:" },
    issue: {
      icon: ExclamationTriangleIcon,
      color: "amber",
      title: "There might be an issue.",
      subtitle: "Last action received:",
    },
  };

  const status = useMemo(() => {
    if (actions && actions.length > 0) {
      const lastEvent = actions[0];
      const currentTime = new Date();
      const lastEventTime = new Date(lastEvent.createdAt);
      const timeDifference = currentTime.getTime() - lastEventTime.getTime();

      if (timeDifference <= 24 * 60 * 60 * 1000) {
        setConfetti(true);
        return "running";
      } else {
        return "issue";
      }
    } else {
      return "notImplemented";
    }
  }, [actions]);

  const currentStatus = stati[status];

  if (type === "large") {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center space-y-2 rounded-lg py-6 text-center",
          status === "notImplemented" && "bg-slate-100",
          status === "running" && "bg-green-100",
          status === "issue" && "bg-amber-100"
        )}>
        <div
          className={clsx(
            "h-12 w-12 rounded-full bg-white p-2",
            status === "notImplemented" && "text-slate-700",
            status === "running" && "text-green-700",
            status === "issue" && "text-amber-700"
          )}>
          <currentStatus.icon />
        </div>
        <p className="text-md font-bold text-slate-800 md:text-xl">{currentStatus.title}</p>
        <p className="text-sm text-slate-700">
          {currentStatus.subtitle}{" "}
          {status !== "notImplemented" && <span>{timeSince(actions[0].createdAt.toISOString())}</span>}
        </p>
        {confetti && <Confetti />}
      </div>
    );
  }
  if (type === "mini") {
    return (
      <Link href={`/environments/${environment.id}/settings/setup`}>
        <div className="group my-4 flex justify-center">
          <div className=" flex rounded-full bg-slate-100 px-2 py-1">
            <p className="mr-2 text-sm text-slate-400 group-hover:underline">
              {currentStatus.subtitle}{" "}
              {status !== "notImplemented" && <span>{timeSince(actions[0].createdAt.toISOString())}</span>}
            </p>
            <div
              className={clsx(
                "h-5 w-5 rounded-full p-0.5",
                status === "notImplemented" && "bg-slate-100 text-slate-700",
                status === "running" && "bg-green-100 text-green-700",
                status === "issue" && "bg-amber-100 text-amber-700"
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
