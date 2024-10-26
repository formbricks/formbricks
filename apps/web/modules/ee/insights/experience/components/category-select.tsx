import { useState } from "react";
import { TBadgeOption } from "@formbricks/types/badge";
import { TInsight } from "@formbricks/types/insights";
import { Badge } from "@formbricks/ui/components/Badge";
import { updateInsightAction } from "../actions";

interface CategoryBadgeProps {
  category: TInsight["category"];
  environmentId: string;
  insightId: string;
}

const categoryOptions: TBadgeOption[] = [
  { text: "Complaint", type: "error" },
  { text: "Request", type: "warning" },
  { text: "Praise", type: "success" },
  { text: "Other", type: "gray" },
];

const categoryMapping: Record<string, TInsight["category"]> = {
  Complaint: "complaint",
  Request: "featureRequest",
  Praise: "praise",
  Other: "other",
};

const getCategoryIndex = (category: TInsight["category"]) => {
  switch (category) {
    case "complaint":
      return 0;
    case "featureRequest":
      return 1;
    case "praise":
      return 2;
    default:
      return 3;
  }
};

const CategoryBadge = ({ category, environmentId, insightId }: CategoryBadgeProps) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateCategory = async (newCategory: TInsight["category"]) => {
    setIsUpdating(true);
    try {
      await updateInsightAction({ environmentId, insightId, updates: { category: newCategory } });
    } catch (error) {
      console.error("Failed to update insight:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Badge
      options={categoryOptions}
      selectedIndex={getCategoryIndex(category)}
      onChange={(newIndex) => {
        const newCategoryText = categoryOptions[newIndex].text;
        const newCategory = categoryMapping[newCategoryText];
        handleUpdateCategory(newCategory);
      }}
      size="tiny"
      isLoading={isUpdating}
    />
  );
};

export default CategoryBadge;
