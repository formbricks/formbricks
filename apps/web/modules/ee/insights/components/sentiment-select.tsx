import { useState } from "react";
import { TBadgeOption } from "@formbricks/types/badge";
import { TDocument, TDocumentSentiment } from "@formbricks/types/documents";
import { Badge } from "@formbricks/ui/components/Badge";
import { updateDocumentAction } from "./insight-sheet/actions";

interface SentimentSelectProps {
  sentiment: TDocument["sentiment"];
  environmentId: string;
  documentId: string;
  insightId: string;
}

const sentimentOptions: TBadgeOption[] = [
  { text: "Positive", type: "success" },
  { text: "Neutral", type: "gray" },
  { text: "Negative", type: "error" },
];

const getSentimentIndex = (sentiment: TDocumentSentiment) => {
  switch (sentiment) {
    case "positive":
      return 0;
    case "neutral":
      return 1;
    case "negative":
      return 2;
    default:
      return 1; // Default to neutral
  }
};

const SentimentSelect = ({ sentiment, environmentId, documentId, insightId }: SentimentSelectProps) => {
  const [currentSentiment, setCurrentSentiment] = useState(sentiment);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateSentiment = async (newSentiment: TDocumentSentiment) => {
    setIsUpdating(true);
    try {
      await updateDocumentAction({
        environmentId,
        documentId,
        insightId,
        updates: { sentiment: newSentiment },
      });
      setCurrentSentiment(newSentiment); // Update the state with the new sentiment
    } catch (error) {
      console.error("Failed to update document sentiment:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Badge
      options={sentimentOptions}
      selectedIndex={getSentimentIndex(currentSentiment)}
      onChange={(newIndex) => {
        const newSentiment = sentimentOptions[newIndex].text.toLowerCase() as TDocumentSentiment;
        handleUpdateSentiment(newSentiment);
      }}
      size="tiny"
      isLoading={isUpdating}
    />
  );
};

export default SentimentSelect;
