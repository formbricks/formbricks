"use client";

import { TagIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { convertDateTimeStringShort } from "@formbricks/lib/time";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";
import { Label } from "@formbricks/ui/Label";
import { LoadingSpinner } from "@formbricks/ui/LoadingSpinner";
import { getSegmentsByAttributeClassAction } from "../actions";

interface EventActivityTabProps {
  attributeClass: TAttributeClass;
}

export const AttributeActivityTab = ({ attributeClass }: EventActivityTabProps) => {
  const [activeSurveys, setActiveSurveys] = useState<string[] | undefined>();
  const [inactiveSurveys, setInactiveSurveys] = useState<string[] | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);

    const getSurveys = async () => {
      setLoading(true);
      const segmentsWithAttributeClassNameResponse = await getSegmentsByAttributeClassAction({
        environmentId: attributeClass.environmentId,
        attributeClass,
      });

      if (segmentsWithAttributeClassNameResponse?.data) {
        setActiveSurveys(segmentsWithAttributeClassNameResponse.data.activeSurveys);
        setInactiveSurveys(segmentsWithAttributeClassNameResponse.data.inactiveSurveys);
      } else {
        const errorMessage = getFormattedErrorMessage(segmentsWithAttributeClassNameResponse);
        setError(new Error(errorMessage));
      }
      setLoading(false);
    };

    getSurveys();
  }, [attributeClass, attributeClass.environmentId, attributeClass.id, attributeClass.name]);

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
            {convertDateTimeStringShort(attributeClass.createdAt.toString())}
          </p>
        </div>{" "}
        <div>
          <Label className="text-xs font-normal text-slate-500">Last updated</Label>
          <p className="text-xs text-slate-700">
            {convertDateTimeStringShort(attributeClass.updatedAt.toString())}
          </p>
        </div>
        <div>
          <Label className="block text-xs font-normal text-slate-500">Type</Label>
          <div className="mt-1 flex items-center">
            <div className="mr-1.5 h-4 w-4 text-slate-600">
              <TagIcon className="h-4 w-4" />
            </div>
            <p className="text-sm text-slate-700">{capitalizeFirstLetter(attributeClass.type)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
