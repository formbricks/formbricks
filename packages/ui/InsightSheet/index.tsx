"use client";

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { timeSince } from "@formbricks/lib/time";
import { TDocument } from "@formbricks/types/documents";
import { TInsight } from "@formbricks/types/insights";
import { Badge } from "../Badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../Card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../Sheet";
import { getDocumentsByInsightIdAction } from "./actions";

interface InsightSheetProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  insight: TInsight | null;
}

export const InsightSheet = ({ isOpen, setIsOpen, insight }: InsightSheetProps) => {
  const [documents, setDocuments] = useState<TDocument[]>([]);

  useEffect(() => {
    if (insight) {
      fetchDocuments();
    }

    async function fetchDocuments() {
      if (!insight) {
        throw Error("Insight is required to fetch documents");
      }
      const documentsResponse = await getDocumentsByInsightIdAction({ insightId: insight.id });
      console.log(documentsResponse);
      if (!documentsResponse?.data) {
        const errorMessage = getFormattedErrorMessage(documentsResponse);
        console.error(errorMessage);
        return;
      }
      setDocuments(documentsResponse.data);
    }
  }, [insight]);

  if (!insight) {
    return null;
  }
  return (
    <Sheet open={isOpen} onOpenChange={(v) => setIsOpen(v)}>
      <SheetContent className="w-[400rem] bg-white lg:max-w-lg xl:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{insight.title}</SheetTitle>
          <SheetDescription>{insight.description}</SheetDescription>
          <div className="flex flex-col space-y-2 pt-4">
            {documents.map((document) => (
              <Card>
                <CardContent className="p-4 text-sm">
                  <Markdown className="whitespace-pre-wrap">{document.text}</Markdown>
                </CardContent>
                <CardFooter className="flex justify-between bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <p>
                    Sentiment:{" "}
                    {document.sentiment === "positive" ? (
                      <Badge text="positive" size="tiny" type="success" />
                    ) : document.sentiment === "neutral" ? (
                      <Badge text="neutral" size="tiny" type="gray" />
                    ) : document.sentiment === "negative" ? (
                      <Badge text="negative" size="tiny" type="error" />
                    ) : null}
                  </p>
                  <p>{timeSince(new Date(document.createdAt).toISOString())}</p>
                </CardFooter>
              </Card>
            ))}
          </div>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
};
