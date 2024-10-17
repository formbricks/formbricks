"use client";

import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { timeSince } from "@formbricks/lib/time";
import { TDocument, TDocumentFilterCriteria } from "@formbricks/types/documents";
import { TInsight } from "@formbricks/types/insights";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { Card, CardContent, CardFooter } from "../Card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../Sheet";
import { getDocumentsByInsightIdAction, getDocumentsByInsightIdSurveyIdQuestionIdAction } from "./actions";

interface InsightSheetProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  insight: TInsight | null;
  surveyId?: string;
  questionId?: string;
  handleFeedback: (feedback: "positive" | "negative") => void;
  documentsFilter?: TDocumentFilterCriteria;
  documentsPerPage?: number;
}

export const InsightSheet = ({
  isOpen,
  setIsOpen,
  insight,
  surveyId,
  questionId,
  handleFeedback,
  documentsFilter,
  documentsPerPage = 10,
}: InsightSheetProps) => {
  const [documents, setDocuments] = useState<TDocument[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!insight) return;

    let documentsResponse;
    if (questionId && surveyId) {
      documentsResponse = await getDocumentsByInsightIdSurveyIdQuestionIdAction({
        insightId: insight.id,
        surveyId,
        questionId,
        limit: documentsPerPage,
        offset: (page - 1) * documentsPerPage,
      });
    } else {
      documentsResponse = await getDocumentsByInsightIdAction({
        insightId: insight.id,
        filterCriteria: documentsFilter,
        limit: documentsPerPage,
        offset: (page - 1) * documentsPerPage,
      });
    }

    if (!documentsResponse?.data) {
      const errorMessage = getFormattedErrorMessage(documentsResponse);
      console.error(errorMessage);
      return;
    }

    const fetchedDocuments = documentsResponse.data;

    if (fetchedDocuments.length < documentsPerPage) {
      setHasMore(false); // No more documents to fetch
    }

    setDocuments((prevDocuments) => [...prevDocuments, ...fetchedDocuments]);
  }, [insight, page, surveyId, questionId, documentsFilter]);

  useEffect(() => {
    if (isOpen) {
      setDocuments([]);
      setPage(1);
      setHasMore(true);
    }
    if (insight) {
      fetchDocuments();
    }
  }, [fetchDocuments, isOpen]);

  const handleFeedbackClick = (feedback: "positive" | "negative") => {
    setIsOpen(false);
    handleFeedback(feedback);
  };

  const loadMoreDocuments = () => {
    if (hasMore) {
      setPage((prevPage) => prevPage + 1);
    }
  };

  if (!insight) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={(v) => setIsOpen(v)}>
      <SheetContent className="flex h-full w-[400rem] flex-col bg-white lg:max-w-lg xl:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            <span className="mr-3">{insight.title}</span>
            {insight.category === "complaint" ? (
              <Badge text="Complaint" type="error" size="tiny" />
            ) : insight.category === "featureRequest" ? (
              <Badge text="Feature Request" type="warning" size="tiny" />
            ) : insight.category === "praise" ? (
              <Badge text="Praise" type="success" size="tiny" />
            ) : null}
          </SheetTitle>
          <SheetDescription>{insight.description}</SheetDescription>
          <div className="flex w-fit items-center gap-2 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-600">
            <p>Did you find this insight helpful?</p>
            <ThumbsUpIcon
              className="upvote h-4 w-4 cursor-pointer hover:text-black"
              onClick={() => handleFeedbackClick("positive")}
            />
            <ThumbsDownIcon
              className="downvote h-4 w-4 cursor-pointer hover:text-black"
              onClick={() => handleFeedbackClick("negative")}
            />
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col space-y-2 overflow-auto pt-4">
          {documents.map((document) => (
            <Card key={document.id}>
              <CardContent className="p-4 text-sm">
                <Markdown className="whitespace-pre-wrap">{document.text}</Markdown>
              </CardContent>
              <CardFooter className="flex justify-between bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <p>
                  Sentiment:{" "}
                  {document.sentiment === "positive" ? (
                    <Badge text="Positive" size="tiny" type="success" />
                  ) : document.sentiment === "neutral" ? (
                    <Badge text="Neutral" size="tiny" type="gray" />
                  ) : document.sentiment === "negative" ? (
                    <Badge text="Negative" size="tiny" type="error" />
                  ) : null}
                </p>
                <p>{timeSince(new Date(document.createdAt).toISOString())}</p>
              </CardFooter>
            </Card>
          ))}
        </div>

        {hasMore && (
          <div className="flex justify-center py-5">
            <Button onClick={loadMoreDocuments} variant="secondary" size="sm">
              Load more
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
