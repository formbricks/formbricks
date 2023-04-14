import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { ErrorComponent } from "@formbricks/ui";
import { Label } from "@formbricks/ui";
import { useEventClass } from "@/lib/eventClasses/eventClasses";
import { convertDateTimeStringShort } from "@formbricks/lib/time";
import { capitalizeFirstLetter } from "@/lib/utils";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/24/solid";

interface ActivityTabProps {
  environmentId: string;
  eventClassId: string;
}

export default function EventActivityTab({ environmentId, eventClassId }: ActivityTabProps) {
  const { eventClass, isLoadingEventClass, isErrorEventClass } = useEventClass(environmentId, eventClassId);

  if (isLoadingEventClass) return <LoadingSpinner />;
  if (isErrorEventClass) return <ErrorComponent />;

  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">Ocurrances</Label>
          <div className="mt-1 grid w-fit grid-cols-3 rounded-lg border-slate-100 bg-slate-50">
            <div className="border-r border-slate-200 px-4 py-2 text-center">
              <p className="font-bold text-slate-800">{eventClass.numEventsLastHour}</p>
              <p className="text-xs text-slate-500">last hour</p>
            </div>
            <div className="border-r border-slate-200 px-4 py-2 text-center">
              <p className="font-bold text-slate-800">{eventClass.numEventsLast24Hours}</p>
              <p className="text-xs text-slate-500">last 24 hours</p>
            </div>
            <div className="px-4 py-2 text-center">
              <p className="font-bold text-slate-800">{eventClass.numEventsLast7Days}</p>
              <p className="text-xs text-slate-500">last week</p>
            </div>
          </div>
        </div>

        <div>
          <Label className="text-slate-500">Active surveys</Label>
          {eventClass.activeSurveys.length === 0 && <p className="text-sm text-slate-900">-</p>}
          {eventClass.activeSurveys.map((surveyName) => (
            <p key={surveyName} className="text-sm text-slate-900">
              {surveyName}
            </p>
          ))}
        </div>
        <div>
          <Label className="text-slate-500">Inactive surveys</Label>
          {eventClass.inactiveSurveys.length === 0 && <p className="text-sm text-slate-900">-</p>}
          {eventClass.inactiveSurveys.map((surveyName) => (
            <p key={surveyName} className="text-sm text-slate-900">
              {surveyName}
            </p>
          ))}
        </div>
      </div>
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div>
          <Label className="text-xs font-normal text-slate-500">Created on</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(eventClass.createdAt.toString())}
          </p>
        </div>{" "}
        <div>
          <Label className=" text-xs font-normal text-slate-500">Last updated</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(eventClass.updatedAt.toString())}
          </p>
        </div>
        <div>
          <Label className="block text-xs font-normal text-slate-500">Type</Label>
          <div className="mt-1 flex items-center">
            <div className="mr-1.5  h-4 w-4 text-slate-600">
              {eventClass.type === "code" ? (
                <CodeBracketIcon />
              ) : eventClass.type === "noCode" ? (
                <CursorArrowRaysIcon />
              ) : eventClass.type === "automatic" ? (
                <SparklesIcon />
              ) : null}
            </div>
            <p className="text-sm text-slate-700 ">{capitalizeFirstLetter(eventClass.type)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
