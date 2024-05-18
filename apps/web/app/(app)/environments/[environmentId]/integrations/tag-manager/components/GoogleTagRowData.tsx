import { timeSinceConditionally } from "@formbricks/lib/time";
import { TGoogleTag } from "@formbricks/types/google-tags";
import { TSurvey } from "@formbricks/types/surveys";

const renderSelectedSurveysText = (tag: TGoogleTag, allSurveys: TSurvey[]) => {
  if (tag.surveyIds.length === 0) {
    const allSurveyNames = allSurveys.map((survey) => survey.name);
    return <p className="text-slate-400">{allSurveyNames.join(", ")}</p>;
  } else {
    const selectedSurveyNames = tag.surveyIds.map((surveyId) => {
      const survey = allSurveys.find((survey) => survey.id === surveyId);
      return survey ? survey.name : "";
    });
    return <p className="text-slate-400">{selectedSurveyNames.join(", ")}</p>;
  }
};

export default function GoogleTagRowData({
  googleTag,
  surveys,
}: {
  googleTag: TGoogleTag;
  surveys: TSurvey[];
}) {
  return (
    <div className="mt-2 grid h-auto grid-cols-12 content-center rounded-lg py-2 hover:bg-slate-100">
      <div className="col-span-3 flex items-center truncate pl-6 text-sm">
        <div className="flex items-center">
          <div className="text-left">
            {googleTag.name ? (
              <div className="text-left">
                <div className="font-medium text-slate-900">{googleTag.name}</div>
                <div className="text-xs text-slate-400">{googleTag.gtmId}</div>
              </div>
            ) : (
              <div className="font-medium text-slate-900">{googleTag.gtmId}</div>
            )}
          </div>
        </div>
      </div>
      <div className="col-span-4 my-auto text-center text-sm text-slate-800">
        {renderSelectedSurveysText(googleTag, surveys)}
      </div>

      <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
        {timeSinceConditionally(googleTag.updatedAt.toString())}
      </div>
      <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
        {timeSinceConditionally(googleTag.createdAt.toString())}
      </div>
      <div className="text-center"></div>
    </div>
  );
}
