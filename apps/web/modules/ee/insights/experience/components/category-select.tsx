"use client";

import { BadgeSelect, TBadgeSelectOption } from "@/modules/ui/components/badge-select";
import { InsightCategory } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { logger } from "@formbricks/logger";
import { updateInsightAction } from "../actions";

interface CategoryBadgeProps {
  category: InsightCategory;
  insightId: string;
  onCategoryChange?: (insightId: string, category: InsightCategory) => void;
}

const categoryOptions: TBadgeSelectOption[] = [
  { text: "Complaint", type: "error" },
  { text: "Request", type: "warning" },
  { text: "Praise", type: "success" },
  { text: "Other", type: "gray" },
];

const categoryMapping: Record<string, InsightCategory> = {
  Complaint: "complaint",
  Request: "featureRequest",
  Praise: "praise",
  Other: "other",
};

const getCategoryIndex = (category: InsightCategory) => {
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
  const { t } = useTranslate();
  const handleUpdateCategory = async (newCategory: InsightCategory) => {
    setIsUpdating(true);
    try {
      await updateInsightAction({ insightId, data: { category: newCategory } });
      onCategoryChange?.(insightId, newCategory);
      toast.success(t("environments.experience.category_updated_successfully"));
    } catch (error) {
      logger.warn(error, t("environments.experience.failed_to_update_category"));
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
