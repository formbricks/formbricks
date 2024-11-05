import { useState } from "react";
import { toast } from "react-hot-toast";
import { TInsight } from "@formbricks/types/insights";
import { BadgeSelect, TBadgeSelectOption } from "@formbricks/ui/components/BadgeSelect";
import { updateInsightAction } from "../actions";

interface CategoryBadgeProps {
  category: TInsight["category"];
  insightId: string;
}

const categoryOptions: TBadgeSelectOption[] = [
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

const CategoryBadge = ({ category, insightId }: CategoryBadgeProps) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateCategory = async (newCategory: TInsight["category"]) => {
    setIsUpdating(true);
    try {
      await updateInsightAction({ insightId, data: { category: newCategory } });
      toast.success("Category updated successfully!");
    } catch (error) {
      console.error("Failed to update insight:", error);
      toast.error("Failed to update category.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <BadgeSelect
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
