"use client";

import { Badge } from "@/modules/ui/components/badge";
import { Webhook } from "@prisma/client";
import { TFnType, useTranslate } from "@tolgee/react";
import { timeSince } from "@formbricks/lib/time";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { TSurvey } from "@formbricks/types/surveys/types";

const renderSelectedSurveysText = (webhook: Webhook, allSurveys: TSurvey[]) => {
  if (webhook.surveyIds.length === 0) {
    const allSurveyNames = allSurveys.map((survey) => survey.name);
    return <p className="text-slate-400">{allSurveyNames.join(", ")}</p>;
  } else {
    const selectedSurveyNames = webhook.surveyIds.map((surveyId) => {
      const survey = allSurveys.find((survey) => survey.id === surveyId);
      return survey ? survey.name : "";
    });
    return <p className="text-slate-400">{selectedSurveyNames.join(", ")}</p>;
  }
};

const renderSelectedTriggersText = (webhook: Webhook, t: TFnType) => {
  if (webhook.triggers.length === 0) {
    return <p className="text-slate-400">No Triggers</p>;
  } else {
    let cleanedTriggers = webhook.triggers.map((trigger) => {
      if (trigger === "responseCreated") {
        return t("environments.integrations.webhooks.response_created");
      } else if (trigger === "responseUpdated") {
        return t("environments.integrations.webhooks.response_updated");
      } else if (trigger === "responseFinished") {
        return t("environments.integrations.webhooks.response_finished");
      } else {
        return trigger;
      }
    });

    return (
      <p className="text-slate-400">
        {cleanedTriggers
          .sort((a, b) => {
            const triggerOrder = {
              "Response Created": 1,
              "Response Updated": 2,
              "Response Finished": 3,
            };

            return triggerOrder[a] - triggerOrder[b];
          })
          .join(", ")}
      </p>
    );
  }
};

export const WebhookRowData = ({ webhook, surveys }: { webhook: Webhook; surveys: TSurvey[] }) => {
  const { t } = useTranslate();
  return (
    <div className="mt-2 grid h-auto grid-cols-12 content-center rounded-lg py-2 hover:bg-slate-100">
      <div className="col-span-3 flex items-center truncate pl-6 text-sm">
        <div className="flex items-center">
          <div className="text-left">
            {webhook.name ? (
              <div className="text-left">
                <div className="font-medium text-slate-900">{webhook.name}</div>
                <div className="text-xs text-slate-400">{webhook.url}</div>
              </div>
            ) : (
              <div className="font-medium text-slate-900">{webhook.url}</div>
            )}
          </div>
        </div>
      </div>
      <div className="col-span-1 my-auto text-center text-sm text-slate-800">
        <Badge type="gray" size="tiny" text={capitalizeFirstLetter(webhook.source) || t("common.user")} />
      </div>
      <div className="col-span-4 my-auto text-center text-sm text-slate-800">
        {renderSelectedSurveysText(webhook, surveys)}
      </div>
      <div className="col-span-2 my-auto text-center text-sm text-slate-800">
        {renderSelectedTriggersText(webhook, t)}
      </div>
      <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
        {timeSince(webhook.createdAt.toString())}
      </div>
      <div className="text-center"></div>
    </div>
  );
};
