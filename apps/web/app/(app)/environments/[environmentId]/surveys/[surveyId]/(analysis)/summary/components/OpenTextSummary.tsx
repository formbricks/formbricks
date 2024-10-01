import { UserIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { timeSince } from "@formbricks/lib/time";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TInsight } from "@formbricks/types/insights";
import { TSurvey, TSurveyQuestionSummaryOpenText } from "@formbricks/types/surveys/types";
import { InsightSheet } from "@formbricks/ui/InsightSheet";
import { PersonAvatar } from "@formbricks/ui/components/Avatars";
import { Badge } from "@formbricks/ui/components/Badge";
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
  const [visibleResponses, setVisibleResponses] = useState(10);
  const [activeTab, setActiveTab] = useState<"insights" | "responses">(
    isAiEnabled ? "insights" : "responses"
  );
  const [isInsightSheetOpen, setIsInsightSheetOpen] = useState(true);
  const [currentInsight, setCurrentInsight] = useState<TInsight | null>(null);

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
      <InsightSheet
        isOpen={isInsightSheetOpen}
        setIsOpen={setIsInsightSheetOpen}
        insight={currentInsight}
        surveyId={survey.id}
        questionId={questionSummary.question.id}
      />
      {isAiEnabled && <SecondaryNavigation activeId={activeTab} navigation={tabNavigation} />}
      <div className="max-h-[40vh] overflow-y-auto">
        {activeTab === "insights" ? (
          <Table className="border-t border-slate-200">
            <TableBody>
              {questionSummary.insights.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <p className="text-slate-500">No insights found for this question.</p>
                  </TableCell>
                </TableRow>
              ) : (
                questionSummary.insights.map((insight) => (
                  <TableRow
                    key={insight.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => {
                      setCurrentInsight(insight);
                      setIsInsightSheetOpen(true);
                    }}>
                    <TableCell className="flex font-medium">
                      {insight._count.documentInsights} <UserIcon className="ml-2 h-4 w-4" />
                    </TableCell>
                    <TableCell className="font-medium">{insight.title}</TableCell>
                    <TableCell>{insight.description}</TableCell>
                    <TableCell>
                      {insight.category === "complaint" ? (
                        <Badge text="Complaint" type="error" size="tiny" />
                      ) : insight.category === "featureRequest" ? (
                        <Badge text="Request" type="warning" size="tiny" />
                      ) : insight.category === "praise" ? (
                        <Badge text="Praise" type="success" size="tiny" />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : activeTab === "responses" ? (
          <>
            <Table className="border-t border-slate-200">
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
