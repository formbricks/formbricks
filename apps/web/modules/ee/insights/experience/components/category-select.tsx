import { BadgeSelect, TBadgeSelectOption } from "@/modules/ui/components/badge-select";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { TInsight } from "@formbricks/types/insights";
import { updateInsightAction } from "../actions";

interface CategoryBadgeProps {
  category: TInsight["category"];
  insightId: string;
  onCategoryChange?: (insightId: string, category: TInsight["category"]) => void;
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

const CategoryBadge = ({ category, insightId, onCategoryChange }: CategoryBadgeProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const t = useTranslations();
  const handleUpdateCategory = async (newCategory: TInsight["category"]) => {
    setIsUpdating(true);
    try {
      await updateInsightAction({ insightId, data: { category: newCategory } });
      onCategoryChange?.(insightId, newCategory);
      toast.success(t("environments.experience.category_updated_successfully"));
    } catch (error) {
      console.error(t("environments.experience.failed_to_update_category"), error);
      toast.error(t("environments.experience.failed_to_update_category"));
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
