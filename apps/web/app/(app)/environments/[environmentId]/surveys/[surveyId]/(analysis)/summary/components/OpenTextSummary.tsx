import { InsightView } from "@/app/(app)/environments/[environmentId]/components/InsightView";
import Link from "next/link";
import { useState } from "react";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { timeSince } from "@formbricks/lib/time";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyQuestionSummaryOpenText } from "@formbricks/types/surveys/types";
import { PersonAvatar } from "@formbricks/ui/components/Avatars";
import { Button } from "@formbricks/ui/components/Button";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formbricks/ui/components/Table";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface OpenTextSummaryProps {
  questionSummary: TSurveyQuestionSummaryOpenText;
  environmentId: string;
  survey: TSurvey;
  attributeClasses: TAttributeClass[];
  isAiEnabled: boolean;
}

export const OpenTextSummary = ({
  questionSummary,
  environmentId,
  survey,
  attributeClasses,
  isAiEnabled,
}: OpenTextSummaryProps) => {
  const isInsightsEnabled = isAiEnabled && questionSummary.insightsEnabled;
  const [visibleResponses, setVisibleResponses] = useState(10);
  const [activeTab, setActiveTab] = useState<"insights" | "responses">(
    isInsightsEnabled ? "insights" : "responses"
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
      label: "Insights",
      onClick: () => setActiveTab("insights"),
    },
    {
      id: "responses",
      label: "Responses",
      onClick: () => setActiveTab("responses"),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        attributeClasses={attributeClasses}
      />
      {isInsightsEnabled && <SecondaryNavigation activeId={activeTab} navigation={tabNavigation} />}
      <div className="border-t border-slate-200"></div>
      <div className="max-h-[40vh] overflow-y-auto">
        {activeTab === "insights" ? (
          <InsightView
            insights={questionSummary.insights}
            questionId={questionSummary.question.id}
            surveyId={survey.id}
          />
        ) : activeTab === "responses" ? (
          <>
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questionSummary.samples.slice(0, visibleResponses).map((response) => (
                  <TableRow key={response.id}>
                    <TableCell>
                      {response.person ? (
                        <Link
                          className="ph-no-capture group flex items-center"
                          href={`/environments/${environmentId}/people/${response.person.id}`}>
                          <div className="hidden md:flex">
                            <PersonAvatar personId={response.person.id} />
                          </div>
                          <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">
                            {getPersonIdentifier(response.person, response.personAttributes)}
                          </p>
                        </Link>
                      ) : (
                        <div className="group flex items-center">
                          <div className="hidden md:flex">
                            <PersonAvatar personId="anonymous" />
                          </div>
                          <p className="break-all text-slate-600 md:ml-2">Anonymous</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{response.value}</TableCell>
                    <TableCell>{timeSince(new Date(response.updatedAt).toISOString())}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visibleResponses < questionSummary.samples.length && (
              <div className="flex justify-center py-4">
                <Button onClick={handleLoadMore} variant="secondary" size="sm">
                  Load more
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
