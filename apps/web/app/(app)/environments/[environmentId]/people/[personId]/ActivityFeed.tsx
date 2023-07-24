import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import { ActivityItemContent, ActivityItemIcon, ActivityItemPopover } from "./ActivityItemComponents";
import { TPersonDetailedAttribute } from "@formbricks/types/v1/people";
import { TDisplaysWithSurveyName } from "@formbricks/types/v1/displays";
import { TSessionWithActions } from "@formbricks/types/v1/sessions";

interface ActivityFeedProps {
  sessions: TSessionWithActions[];
  attributes: TPersonDetailedAttribute[];
  displays: TDisplaysWithSurveyName[];
  sortByDate: boolean;
  environmentId: string;
}

export type ActivityFeedItem = {
  id: string;
  type: "event" | "attribute" | "display";
  createdAt: Date;
  updatedAt?: Date;
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
  sortByDate,
  environmentId,
}: ActivityFeedProps) {
  const unifiedAttributes: ActivityFeedItem[] = attributes.map((attribute: TPersonDetailedAttribute) => ({
    id: attribute.id,
    type: "attribute",
    createdAt: attribute.createdAt,
    updatedAt: attribute.updatedAt,
    attributeLabel: attribute.name,
    attributeValue: attribute.value,
  }));
  const unifiedDisplays: ActivityFeedItem[] = displays.map((display: TDisplaysWithSurveyName) => ({
    id: display.id,
    type: "display",
    createdAt: display.createdAt,
    updatedAt: display.updatedAt,
    displaySurveyId: display.surveyId,
  }));
  const unifiedEvents: ActivityFeedItem[] = sessions.flatMap((session: TSessionWithActions) =>
    session.events.map((event) => ({
      id: event.id,
      type: "event",
      eventType: event.eventClass?.type,
      createdAt: event.createdAt,
      eventLabel: event.eventClass?.name,
      eventDescription: event.eventClass?.description ? undefined : "",
    }))
  );

  const unifiedList: ActivityFeedItem[] = [...unifiedAttributes, ...unifiedDisplays, ...unifiedEvents].sort(
    (a, b) =>
      sortByDate
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
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
                  <ActivityItemPopover activityItem={activityItem} displays={displays}>
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
