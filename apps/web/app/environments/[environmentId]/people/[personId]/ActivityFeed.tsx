import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { useMemo } from "react";
import { ActivityItemContent, ActivityItemIcon, ActivityItemPopover } from "./ActivityItemComponents";

interface ActivityFeedProps {
  sessions: any[];
  attributes: any[];
  displays: any[];
  responses: any[];
  sortByDate: boolean;
  environmentId: string;
}

export type ActivityFeedItem = {
  id: string;
  type: "event" | "attribute" | "display";
  createdAt: string;
  updatedAt?: string;
  attributeLabel?: string;
  attributeValue?: string;
  displaySurveyId?: string;
  eventLabel?: string;
  eventDescription?: string;
  eventType?: string;
};

export default function ActivityFeed({
  sessions,
  attributes,
  displays,
  responses,
  sortByDate,
  environmentId,
}: ActivityFeedProps) {
  // Convert Attributes into unified format
  const unifiedAttributes = useMemo(() => {
    if (attributes) {
      return attributes.map((attribute) => ({
        id: attribute.id,
        type: "attribute",
        createdAt: attribute.createdAt,
        updatedAt: attribute.updatedAt,
        attributeLabel: attribute.attributeClass.name,
        attributeValue: attribute.value,
      }));
    }
    return [];
  }, [attributes]);

  // Convert Displays into unified format
  const unifiedDisplays = useMemo(() => {
    if (displays) {
      return displays.map((display) => ({
        id: display.id,
        type: "display",
        createdAt: display.createdAt,
        updatedAt: display.updatedAt,
        displaySurveyId: display.surveyId,
      }));
    }
    return [];
  }, [displays]);

  // Convert Events into unified format
  const unifiedEvents = useMemo(() => {
    if (sessions) {
      return sessions.flatMap((session) =>
        session.events.map((event) => ({
          id: event.id,
          type: "event",
          eventType: event.eventClass.type,
          createdAt: event.createdAt,
          eventLabel: event.eventClass.name,
          eventDescription: event.eventClass.description,
        }))
      );
    }
    return [];
  }, [sessions]);

  const unifiedList = useMemo<ActivityFeedItem[]>(() => {
    return [...unifiedAttributes, ...unifiedDisplays, ...unifiedEvents].sort((a, b) =>
      sortByDate
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [unifiedAttributes, unifiedDisplays, unifiedEvents, sortByDate]);

  return (
    <>
      {unifiedList.length === 0 ? (
        <EmptySpaceFiller type={"event"} environmentId={environmentId} />
      ) : (
        <div>
          {unifiedList.map((activityItem) => (
            <li key={activityItem.id} className="list-none">
              <div className="relative pb-12">
                <span className="absolute left-6 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                <div className="relative">
                  <ActivityItemPopover activityItem={activityItem} responses={responses}>
                    <div className="flex space-x-3 text-left">
                      <ActivityItemIcon activityItem={activityItem} />
                      <ActivityItemContent activityItem={activityItem} />
                    </div>
                  </ActivityItemPopover>
                </div>
              </div>
            </li>
          ))}
        </div>
      )}
    </>
  );
}
