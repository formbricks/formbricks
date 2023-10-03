"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { ErrorComponent } from "@formbricks/ui";
import { Label } from "@formbricks/ui";
import { convertDateTimeStringShort } from "@formbricks/lib/time";
import { capitalizeFirstLetter } from "@/lib/utils";
import { CodeBracketIcon, CursorArrowRaysIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { TActionClass } from "@formbricks/types/v1/actionClasses";
import { useEffect, useState } from "react";
import {
  getActionCountInLastHourAction,
  getActionCountInLast24HoursAction,
  getActionCountInLast7DaysAction,
  GetActiveInactiveSurveysAction,
} from "./actions";
interface ActivityTabProps {
  actionClass: TActionClass;
}

export default function EventActivityTab({ actionClass }: ActivityTabProps) {
  // const { eventClass, isLoadingEventClass, isErrorEventClass } = useEventClass(environmentId, actionClass.id);

  const [numEventsLastHour, setNumEventsLastHour] = useState<number | undefined>();
  const [numEventsLast24Hours, setNumEventsLast24Hours] = useState<number | undefined>();
  const [numEventsLast7Days, setNumEventsLast7Days] = useState<number | undefined>();
  const [activeSurveys, setActiveSurveys] = useState<string[] | undefined>();
  const [inactiveSurveys, setInactiveSurveys] = useState<string[] | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    updateState();

    async function updateState() {
      try {
        setLoading(true);
        const [
          numEventsLastHourData,
          numEventsLast24HoursData,
          numEventsLast7DaysData,
          activeInactiveSurveys,
        ] = await Promise.all([
          getActionCountInLastHourAction(actionClass.id),
          getActionCountInLast24HoursAction(actionClass.id),
          getActionCountInLast7DaysAction(actionClass.id),
          GetActiveInactiveSurveysAction(actionClass.id),
        ]);
        setNumEventsLastHour(numEventsLastHourData);
        setNumEventsLast24Hours(numEventsLast24HoursData);
        setNumEventsLast7Days(numEventsLast7DaysData);
        setActiveSurveys(activeInactiveSurveys.activeSurveys);
        setInactiveSurveys(activeInactiveSurveys.inactiveSurveys);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
  }, [actionClass.id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorComponent />;

  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">Ocurrances</Label>
          <div className="mt-1 grid w-fit grid-cols-3 rounded-lg border-slate-100 bg-slate-50">
            <div className="border-r border-slate-200 px-4 py-2 text-center">
              <p className="font-bold text-slate-800">{numEventsLastHour}</p>
              <p className="text-xs text-slate-500">last hour</p>
            </div>
            <div className="border-r border-slate-200 px-4 py-2 text-center">
              <p className="font-bold text-slate-800">{numEventsLast24Hours}</p>
              <p className="text-xs text-slate-500">last 24 hours</p>
            </div>
            <div className="px-4 py-2 text-center">
              <p className="font-bold text-slate-800">{numEventsLast7Days}</p>
              <p className="text-xs text-slate-500">last week</p>
            </div>
          </div>
        </div>

        <div>
          <Label className="text-slate-500">Active surveys</Label>
          {activeSurveys?.length === 0 && <p className="text-sm text-slate-900">-</p>}
          {activeSurveys?.map((surveyName) => (
            <p key={surveyName} className="text-sm text-slate-900">
              {surveyName}
            </p>
          ))}
        </div>
        <div>
          <Label className="text-slate-500">Inactive surveys</Label>
          {inactiveSurveys?.length === 0 && <p className="text-sm text-slate-900">-</p>}
          {inactiveSurveys?.map((surveyName) => (
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
            {convertDateTimeStringShort(actionClass.createdAt?.toString())}
          </p>
        </div>{" "}
        <div>
          <Label className=" text-xs font-normal text-slate-500">Last updated</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(actionClass.updatedAt?.toString())}
          </p>
        </div>
        <div>
          <Label className="block text-xs font-normal text-slate-500">Type</Label>
          <div className="mt-1 flex items-center">
            <div className="mr-1.5  h-4 w-4 text-slate-600">
              {actionClass.type === "code" ? (
                <CodeBracketIcon />
              ) : actionClass.type === "noCode" ? (
                <CursorArrowRaysIcon />
              ) : actionClass.type === "automatic" ? (
                <SparklesIcon />
              ) : null}
            </div>
            <p className="text-sm text-slate-700 ">{capitalizeFirstLetter(actionClass.type)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
