import { Label } from "@formbricks/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui";
import { timeSince } from "@formbricks/lib/time";
import { capitalizeFirstLetter } from "@/lib/utils";
import {
  CodeBracketIcon,
  CursorArrowRaysIcon,
  EyeIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  TagIcon,
} from "@heroicons/react/24/solid";
import { ActivityFeedItem } from "./ActivityFeed"; // Import the ActivityFeedItem type from the main file

export const ActivityItemIcon = ({ activityItem }: { activityItem: ActivityFeedItem }) => (
  <div className="h-12 w-12 rounded-full bg-white p-3 text-slate-500  duration-100 ease-in-out group-hover:scale-110 group-hover:text-slate-600">
    {activityItem.type === "attribute" ? (
      <TagIcon />
    ) : activityItem.type === "display" ? (
      <EyeIcon />
    ) : activityItem.type === "event" ? (
      <div>
        {activityItem.eventType === "code" && <CodeBracketIcon />}
        {activityItem.eventType === "noCode" && <CursorArrowRaysIcon />}
        {activityItem.eventType === "automatic" && <SparklesIcon />}
      </div>
    ) : (
      <QuestionMarkCircleIcon />
    )}
  </div>
);

export const ActivityItemContent = ({ activityItem }: { activityItem: ActivityFeedItem }) => (
  <div>
    <div className="font-semibold text-slate-700">
      {activityItem.type === "attribute" ? (
        <p>{capitalizeFirstLetter(activityItem.attributeLabel)} added</p>
      ) : activityItem.type === "display" ? (
        <p>Seen survey</p>
      ) : activityItem.type === "event" ? (
        <p>{activityItem.eventLabel} triggered</p>
      ) : (
        <p>Unknown Activity</p>
      )}
    </div>
    <div className="text-sm text-slate-400">
      <time dateTime={timeSince(activityItem.createdAt)}>{timeSince(activityItem.createdAt)}</time>
    </div>
  </div>
);

export const ActivityItemPopover = ({
  activityItem,
  responses,
  children,
}: {
  activityItem: ActivityFeedItem;
  responses: any[];
  children: React.ReactNode;
}) => {
  function findMatchingSurveyName(responses, surveyId) {
    for (const response of responses) {
      if (response.survey.id === surveyId) {
        return response.survey.name;
      }
      return null; // Return null if no match is found
    }
  }

  return (
    <Popover>
      <PopoverTrigger className="group">{children}</PopoverTrigger>
      <PopoverContent className="bg-white">
        <div className="">
          {activityItem.type === "attribute" ? (
            <div>
              <Label className="font-normal text-slate-400">Attribute Label</Label>
              <p className=" mb-2 text-sm font-medium text-slate-900">{activityItem.attributeLabel}</p>
              <Label className="font-normal text-slate-400">Attribute Value</Label>
              <p className="text-sm font-medium text-slate-900">{activityItem.attributeValue}</p>
            </div>
          ) : activityItem.type === "display" ? (
            <div>
              <Label className="font-normal text-slate-400">Survey Name</Label>
              <p className=" mb-2 text-sm font-medium text-slate-900">
                {findMatchingSurveyName(responses, activityItem.displaySurveyId)}
              </p>
            </div>
          ) : activityItem.type === "event" ? (
            <div>
              <div>
                <Label className="font-normal text-slate-400">Event Display Name</Label>
                <p className=" mb-2 text-sm font-medium text-slate-900">{activityItem.eventLabel}</p>{" "}
                <Label className="font-normal text-slate-400">Event Description</Label>
                <p className=" mb-2 text-sm font-medium text-slate-900">
                  {activityItem.eventDescription ? (
                    <span>{activityItem.eventDescription}</span>
                  ) : (
                    <span>-</span>
                  )}
                </p>
                <Label className="font-normal text-slate-400">Event Type</Label>
                <p className="text-sm font-medium text-slate-900">
                  {capitalizeFirstLetter(activityItem.eventType)}
                </p>
              </div>
            </div>
          ) : (
            <QuestionMarkCircleIcon />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
