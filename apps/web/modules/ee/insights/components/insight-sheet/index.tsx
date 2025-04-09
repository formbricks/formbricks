"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { TInsightWithDocumentCount } from "@/modules/ee/insights/experience/types/insights";
import { Button } from "@/modules/ui/components/button";
import { Card, CardContent, CardFooter } from "@/modules/ui/components/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/modules/ui/components/sheet";
import { useTranslate } from "@tolgee/react";
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import Markdown from "react-markdown";
import { timeSince } from "@formbricks/lib/time";
import { TDocument, TDocumentFilterCriteria } from "@formbricks/types/documents";
import { TUserLocale } from "@formbricks/types/user";
import CategoryBadge from "../../experience/components/category-select";
import SentimentSelect from "../sentiment-select";
import { getDocumentsByInsightIdAction, getDocumentsByInsightIdSurveyIdQuestionIdAction } from "./actions";

interface InsightSheetProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  insight: TInsightWithDocumentCount | null;
  surveyId?: string;
  questionId?: string;
  handleFeedback: (feedback: "positive" | "negative") => void;
  documentsFilter?: TDocumentFilterCriteria;
  documentsPerPage?: number;
  locale: TUserLocale;
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
  locale,
}: InsightSheetProps) => {
  const { t } = useTranslate();
  const [documents, setDocuments] = useState<TDocument[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false); // New state for loading
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDocuments([]);
      setPage(1);
      setHasMore(false); // Reset hasMore when the sheet is opened
    }
    if (isOpen && insight) {
      fetchDocuments();
    }

    async function fetchDocuments() {
      if (!insight) return;
      if (isLoading) return; // Prevent fetching if already loading
      setIsLoading(true); // Set loading state to true

      try {
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

        setDocuments((prevDocuments) => {
          // Remove duplicates based on document ID
          const uniqueDocuments = new Map<string, TDocument>([
            ...prevDocuments.map((doc) => [doc.id, doc]),
            ...fetchedDocuments.map((doc) => [doc.id, doc]),
          ]);
          return Array.from(uniqueDocuments.values()) as TDocument[];
        });

        setHasMore(fetchedDocuments.length === documentsPerPage);
      } finally {
        setIsLoading(false); // Reset loading state
      }
    }
  }, [isOpen, insight]);

  const deferredDocuments = useDeferredValue(documents);

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
      <SheetContent className="flex h-full flex-col bg-white">
        <SheetHeader className="flex flex-col gap-1.5">
          <SheetTitle className="flex items-center gap-x-2">
            <span>{insight.title}</span>
            <CategoryBadge category={insight.category} insightId={insight.id} />
          </SheetTitle>
          <SheetDescription>{insight.description}</SheetDescription>
          <div className="flex w-fit items-center gap-2 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-600">
            <p>{t("environments.experience.did_you_find_this_insight_helpful")}</p>
            <ThumbsUpIcon
              className="upvote h-4 w-4 cursor-pointer text-slate-700 hover:text-emerald-500"
              onClick={() => handleFeedbackClick("positive")}
            />
            <ThumbsDownIcon
              className="downvote h-4 w-4 cursor-pointer text-slate-700 hover:text-amber-600"
              onClick={() => handleFeedbackClick("negative")}
            />
          </div>
        </SheetHeader>
        <hr className="my-2" />
        <div className="flex flex-1 flex-col gap-y-2 overflow-auto">
          {deferredDocuments.map((document, index) => (
            <Card key={`${document.id}-${index}`} className="transition-opacity duration-200">
              <CardContent className="whitespace-pre-wrap p-4 text-sm">
                <Markdown>{document.text}</Markdown>
              </CardContent>
              <CardFooter className="flex justify-between rounded-bl-xl rounded-br-xl border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <p>
                  Sentiment: <SentimentSelect documentId={document.id} sentiment={document.sentiment} />
                </p>
                <p>{timeSince(new Date(document.createdAt).toISOString(), locale)}</p>
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
