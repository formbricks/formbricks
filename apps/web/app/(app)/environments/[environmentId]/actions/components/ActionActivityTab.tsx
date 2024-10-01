"use client";

import { Code2Icon, MousePointerClickIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { convertDateTimeStringShort } from "@formbricks/lib/time";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { TActionClass } from "@formbricks/types/action-classes";
import { ErrorComponent } from "@formbricks/ui/components/ErrorComponent";
import { Label } from "@formbricks/ui/components/Label";
import { LoadingSpinner } from "@formbricks/ui/components/LoadingSpinner";
import { getActiveInactiveSurveysAction } from "../actions";

interface ActivityTabProps {
  actionClass: TActionClass;
  environmentId: string;
}

export const ActionActivityTab = ({ actionClass, environmentId }: ActivityTabProps) => {
  const [activeSurveys, setActiveSurveys] = useState<string[] | undefined>();
  const [inactiveSurveys, setInactiveSurveys] = useState<string[] | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);

    const updateState = async () => {
      setLoading(true);
      const getActiveInactiveSurveysResponse = await getActiveInactiveSurveysAction({
        actionClassId: actionClass.id,
      });
      if (getActiveInactiveSurveysResponse?.data) {
        setActiveSurveys(getActiveInactiveSurveysResponse.data.activeSurveys);
        setInactiveSurveys(getActiveInactiveSurveysResponse.data.inactiveSurveys);
      } else {
        const errorMessage = getFormattedErrorMessage(getActiveInactiveSurveysResponse);
        setError(new Error(errorMessage));
      }
      setLoading(false);
    };

    updateState();
  }, [actionClass.id, environmentId]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorComponent />;

  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
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
          <p className="text-xs text-slate-700">
            {convertDateTimeStringShort(actionClass.createdAt?.toString())}
          </p>
        </div>{" "}
        <div>
          <Label className="text-xs font-normal text-slate-500">Last updated</Label>
          <p className="text-xs text-slate-700">
            {convertDateTimeStringShort(actionClass.updatedAt?.toString())}
          </p>
        </div>
        <div>
          <Label className="block text-xs font-normal text-slate-500">Type</Label>
          <div className="mt-1 flex items-center">
            <div className="mr-1.5 h-4 w-4 text-slate-600">
              {actionClass.type === "code" ? (
                <Code2Icon className="h-5 w-5" />
              ) : actionClass.type === "noCode" ? (
                <MousePointerClickIcon className="h-5 w-5" />
              ) : actionClass.type === "automatic" ? (
                <SparklesIcon className="h-5 w-5" />
              ) : null}
            </div>
            <p className="text-sm text-slate-700">{capitalizeFirstLetter(actionClass.type)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
