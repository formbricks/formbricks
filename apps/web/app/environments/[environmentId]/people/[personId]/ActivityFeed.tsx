import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { useEffect, useMemo } from "react";
import { ActivityItemContent, ActivityItemIcon, ActivityItemPopover } from "./ActivityItemComponents";

interface ActivityFeedProps {
  sessions: any[];
  attributes: any[];
  displays: any[];
  responses: any[];
  sortByDate: boolean;
  attributeMap: any[];
  setAttributeMap: (attributeMap: any[]) => void;
}

export type ActivityFeedItem = {
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
  attributeMap,
  setAttributeMap,
}: ActivityFeedProps) {
  useEffect(() => {
    if (attributes) {
      const computedUnifiedAttributes = attributes.map((attribute) => ({
        type: "attribute",
        createdAt: attribute.createdAt,
        updatedAt: attribute.updatedAt,
        attributeLabel: attribute.attributeClass.name,
        attributeValue: attribute.value,
      }));

      // Pass the computedUnifiedAttributes to the parent component
      setAttributeMap(computedUnifiedAttributes);
    }
  }, [attributes, setAttributeMap]);

  // Get Displays into unified format
  const unifiedDisplays = useMemo(() => {
    if (displays) {
      return displays.map((display) => ({
        type: "display",
        createdAt: display.createdAt,
        updatedAt: display.updatedAt,
        displaySurveyId: display.surveyId,
      }));
    }
    return [];
  }, [displays]);

  // Get Eventis into unified format
  const unifiedEvents = useMemo(() => {
    if (sessions) {
      return sessions.flatMap((session) =>
        session.events.map((event) => ({
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
    return [...attributeMap, ...unifiedDisplays, ...unifiedEvents];
  }, [attributeMap, unifiedDisplays, unifiedEvents]);

  return (
    <>
      {unifiedList.length === 0 ? (
        <EmptySpaceFiller type="event" />
      ) : (
        <div>
          {unifiedList
            .slice()
            .sort((a, b) =>
              sortByDate
                ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
            .map((activityItem) => (
              <li key={activityItem.createdAt} className="list-none">
                <div className="relative pb-12">
                  <span
                    className="absolute top-4 left-6 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
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
