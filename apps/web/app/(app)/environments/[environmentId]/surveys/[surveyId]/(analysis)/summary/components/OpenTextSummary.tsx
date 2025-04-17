"use client";

import { renderHyperlinkedContent } from "@/modules/analysis/utils";
import { InsightView } from "@/modules/ee/insights/components/insights-view";
import { PersonAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useState } from "react";
import { timeSince } from "@formbricks/lib/time";
import { getContactIdentifier } from "@formbricks/lib/utils/contact";
import { TSurvey, TSurveyQuestionSummaryOpenText } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface OpenTextSummaryProps {
  questionSummary: TSurveyQuestionSummaryOpenText;
  environmentId: string;
  survey: TSurvey;
  isAIEnabled: boolean;
  documentsPerPage?: number;
  locale: TUserLocale;
}

export const OpenTextSummary = ({
  questionSummary,
  environmentId,
  survey,
  isAIEnabled,
  documentsPerPage,
  locale,
}: OpenTextSummaryProps) => {
  const { t } = useTranslate();
  const isInsightsEnabled = isAIEnabled && questionSummary.insightsEnabled;
  const [visibleResponses, setVisibleResponses] = useState(10);
  const [activeTab, setActiveTab] = useState<"insights" | "responses">(
    isInsightsEnabled && questionSummary.insights.length ? "insights" : "responses"
  );

  const handleLoadMore = () => {
    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleResponses((prevVisibleResponses) =>
      Math.min(prevVisibleResponses + 10, questionSummary.samples.length)
    );
  };

  const tabNavigation = [
    {
      id: "insights",
      label: t("common.insights"),
      onClick: () => setActiveTab("insights"),
    },
    {
      id: "responses",
      label: t("common.responses"),
      onClick: () => setActiveTab("responses"),
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        additionalInfo={
          isAIEnabled && questionSummary.insightsEnabled === false ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center rounded-lg bg-slate-100 p-2">
                {t("environments.surveys.summary.insights_disabled")}
              </div>
            </div>
          ) : undefined
        }
      />
      {isInsightsEnabled && (
        <div className="ml-4">
          <SecondaryNavigation activeId={activeTab} navigation={tabNavigation} />
        </div>
      )}
      <div className="border-t border-slate-200"></div>
      <div className="max-h-[40vh] overflow-y-auto">
        {activeTab === "insights" ? (
          <InsightView
            insights={questionSummary.insights}
            questionId={questionSummary.question.id}
            surveyId={survey.id}
            documentsPerPage={documentsPerPage}
            locale={locale}
          />
        ) : activeTab === "responses" ? (
          <>
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead>{t("common.user")}</TableHead>
                  <TableHead>{t("common.response")}</TableHead>
                  <TableHead>{t("common.time")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questionSummary.samples.slice(0, visibleResponses).map((response) => (
                  <TableRow key={response.id}>
                    <TableCell>
                      {response.contact ? (
                        <Link
                          className="ph-no-capture group flex items-center"
                          href={`/environments/${environmentId}/contacts/${response.contact.id}`}>
                          <div className="hidden md:flex">
                            <PersonAvatar personId={response.contact.id} />
                          </div>
                          <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">
                            {getContactIdentifier(response.contact, response.contactAttributes)}
                          </p>
                        </Link>
                      ) : (
                        <div className="group flex items-center">
                          <div className="hidden md:flex">
                            <PersonAvatar personId="anonymous" />
                          </div>
                          <p className="break-normal text-slate-600 md:ml-2">{t("common.anonymous")}</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {typeof response.value === "string"
                        ? renderHyperlinkedContent(response.value)
                        : response.value}
                    </TableCell>
                    <TableCell width={120}>
                      {timeSince(new Date(response.updatedAt).toISOString(), locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visibleResponses < questionSummary.samples.length && (
              <div className="flex justify-center py-4">
                <Button onClick={handleLoadMore} variant="secondary" size="sm">
                  {t("common.load_more")}
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
