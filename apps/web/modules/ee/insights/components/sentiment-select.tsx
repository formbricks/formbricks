import { BadgeSelect, TBadgeSelectOption } from "@/modules/ui/components/badge-select";
import { useState } from "react";
import { TDocument, TDocumentSentiment } from "@formbricks/types/documents";
import { updateDocumentAction } from "./insight-sheet/actions";

interface SentimentSelectProps {
  sentiment: TDocument["sentiment"];
  documentId: string;
}

const sentimentOptions: TBadgeSelectOption[] = [
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

const SentimentSelect = ({ sentiment, documentId }: SentimentSelectProps) => {
  const [currentSentiment, setCurrentSentiment] = useState(sentiment);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateSentiment = async (newSentiment: TDocumentSentiment) => {
    setIsUpdating(true);
    try {
      await updateDocumentAction({
        documentId,
        data: { sentiment: newSentiment },
      });
      setCurrentSentiment(newSentiment); // Update the state with the new sentiment
    } catch (error) {
      console.error("Failed to update document sentiment:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <BadgeSelect
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
