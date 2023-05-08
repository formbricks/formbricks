"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Confetti } from "@formbricks/ui/Confetti";
import { useEnvironment } from "@/lib/environments/environments";
import { useEnvironmentMutation } from "@/lib/environments/mutateEnvironments";
import { useEvents } from "@/lib/events/events";
import { timeSince } from "@formbricks/lib/time";
import { ArrowDownIcon, CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

interface WidgetStatusIndicatorProps {
  environmentId: string;
  type: "large" | "mini";
}

export default function WidgetStatusIndicator({ environmentId, type }: WidgetStatusIndicatorProps) {
  const { events, isLoadingEvents, isErrorEvents } = useEvents(environmentId);
  const { triggerEnvironmentMutate } = useEnvironmentMutation(environmentId);
  const { environment, isErrorEnvironment, isLoadingEnvironment } = useEnvironment(environmentId);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (!environment?.widgetSetupCompleted && events && events.length > 0) {
      triggerEnvironmentMutate({ widgetSetupCompleted: true });
    }
  }, [environment, triggerEnvironmentMutate, events]);

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
    if (events && events.length > 0) {
      const lastEvent = events[0];
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
  }, [events]);

  const currentStatus = stati[status];

  if (isLoadingEvents || isLoadingEnvironment) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorEvents || isErrorEnvironment) {
    return <ErrorComponent />;
  }

  if (type === "large") {
    return (
      <div
        className={clsx(
          "flex flex-col items-center justify-center space-y-2 rounded-lg py-6",
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
        <p className="text-xl font-bold text-slate-800">{currentStatus.title}</p>
        <p className="text-sm text-slate-700">
          {currentStatus.subtitle}{" "}
          {status !== "notImplemented" && <span>{timeSince(events[0].createdAt)}</span>}
        </p>
        {confetti && <Confetti />}
      </div>
    );
  }
  if (type === "mini") {
    return (
      <Link href={`/environments/${environmentId}/settings/setup`}>
        <div className="group my-4 flex justify-center">
          <div className=" flex rounded-full bg-slate-100 px-2 py-1">
            <p className="mr-2 text-sm text-slate-400 group-hover:underline">
              {currentStatus.subtitle}{" "}
              {status !== "notImplemented" && <span>{timeSince(events[0].createdAt)}</span>}
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
