"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import { useEvents } from "@/lib/events/events";
import clsx from "clsx";
import { timeSince } from "@/lib/time";

export default function WidgetStatusIndicator({ environmentId }) {
  const { events, isLoadingEvents, isErrorEvents } = useEvents(environmentId);

  const stati = {
    notImplemented: {
      icon: CheckIcon,
      color: "slate",
      title: "Not implemented yet.",
      subtitle: "The Formbricks widget has not yet been implemented.",
    },
    running: { icon: CheckIcon, color: "green", title: "Receiving data.", subtitle: "Last event received:" },
    issue: {
      icon: ExclamationTriangleIcon,
      color: "amber",
      title: "There might be an issue.",
      subtitle: "Last event received:",
    },
  };

  const status = useMemo(() => {
    if (events && events.length > 0) {
      const lastEvent = events[0];
      const currentTime = new Date();
      const lastEventTime = new Date(lastEvent.createdAt);
      const timeDifference = currentTime.getTime() - lastEventTime.getTime();

      if (timeDifference <= 24 * 60 * 60 * 1000) {
        return "running";
      } else {
        return "issue";
      }
    } else {
      return "notImplemented";
    }
  }, [events]);

  const currentStatus = stati[status];

  if (isLoadingEvents) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorEvents) {
    return <div>Error loading resources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  console.log("events", events);
  console.log("status", status);
  console.log("currentStatus", currentStatus);

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
    </div>
  );
}
