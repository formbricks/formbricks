import { convertDateTimeStringShort } from "@formbricks/lib/time";
import { TGoogleTag } from "@formbricks/types/google-tags";
import { TSurvey } from "@formbricks/types/surveys";
import { Label } from "@formbricks/ui/Label";

interface ActivityTabProps {
  tag: TGoogleTag;
  surveys: TSurvey[];
}

const getSurveyNamesForGoogleTag = (tag: TGoogleTag, allSurveys: TSurvey[]): string[] => {
  if (tag.surveyIds.length === 0) {
    return allSurveys.map((survey) => survey.name);
  } else {
    return tag.surveyIds.map((surveyId) => {
      const survey = allSurveys.find((survey) => survey.id === surveyId);
      return survey ? survey.name : "";
    });
  }
};

export default function GoogleTagOverviewTab({ tag, surveys }: ActivityTabProps) {
  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">Name</Label>
          <p className="truncate text-sm text-slate-900">{tag.name ? tag.name : "-"}</p>
        </div>

        <div>
          <Label className="text-slate-500">GTM ID</Label>
          <p className="text-sm text-slate-900">{tag.gtmId}</p>
        </div>

        <div>
          <Label className="text-slate-500">Surveys</Label>

          {getSurveyNamesForGoogleTag(tag, surveys).map((surveyName, index) => (
            <p key={index} className="text-sm text-slate-900">
              {surveyName}
            </p>
          ))}
        </div>
      </div>
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div>
          <Label className="text-xs font-normal text-slate-500">Created on</Label>
          <p className=" text-xs text-slate-700">{convertDateTimeStringShort(tag.createdAt?.toString())}</p>
        </div>
        <div>
          <Label className=" text-xs font-normal text-slate-500">Last updated</Label>
          <p className=" text-xs text-slate-700">{convertDateTimeStringShort(tag.updatedAt?.toString())}</p>
        </div>
      </div>
    </div>
  );
}
