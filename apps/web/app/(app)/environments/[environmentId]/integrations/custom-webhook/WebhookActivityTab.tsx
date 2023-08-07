import { Label } from "@formbricks/ui";
import { convertDateTimeStringShort } from "@formbricks/lib/time";
import { TWebhook } from "@formbricks/types/v1/webhooks";
import { TSurvey } from "@formbricks/types/v1/surveys";

interface ActivityTabProps {
  webhook: TWebhook;
  surveys: TSurvey[];
}

const convertTriggerIdToName = (triggerId: string): string => {
  switch (triggerId) {
    case "responseCreated":
      return "Response Created";
    case "responseUpdated":
      return "Response Updated";
    case "responseFinished":
      return "Response Finished";
    default:
      return triggerId;
  }
};

export default function WebhookActivityTab({ webhook, surveys }: ActivityTabProps) {
  return (
    <div className="grid grid-cols-3 pb-2">
      <div className="col-span-2 space-y-4 pr-6">
        <div>
          <Label className="text-slate-500">URL</Label>
          <p className="text-sm text-slate-900">{webhook.url}</p>
        </div>

        <div>
          <Label className="text-slate-500">Surveys</Label>
          {webhook.surveyIds.length === 0 && <p className="text-sm text-slate-900">-</p>}
          {webhook.surveyIds
            .map((surveyId) => surveys.find((survey) => survey.id === surveyId)?.name)
            .map((surveyName) => (
              <p key={surveyName} className="text-sm text-slate-900">
                {surveyName}
              </p>
            ))}
        </div>
        <div>
          <Label className="text-slate-500">Triggers</Label>
          {webhook.triggers.length === 0 && <p className="text-sm text-slate-900">-</p>}
          {webhook.triggers.map((triggerId) => (
            <p key={triggerId} className="text-sm text-slate-900">
              {convertTriggerIdToName(triggerId)}
            </p>
          ))}
        </div>
      </div>
      <div className="col-span-1 space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div>
          <Label className="text-xs font-normal text-slate-500">Created on</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(webhook.createdAt?.toString())}
          </p>
        </div>
        <div>
          <Label className=" text-xs font-normal text-slate-500">Last updated</Label>
          <p className=" text-xs text-slate-700">
            {convertDateTimeStringShort(webhook.updatedAt?.toString())}
          </p>
        </div>
      </div>
    </div>
  );
}
