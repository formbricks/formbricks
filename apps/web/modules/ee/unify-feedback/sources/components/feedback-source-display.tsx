"use client";

import { FileSpreadsheetIcon, FormIcon } from "lucide-react";
import { TFeedbackSourceType } from "@formbricks/types/feedback-source";

export const getFeedbackSourceIcon = (type: TFeedbackSourceType, className: string) => {
  switch (type) {
    case "formbricks_survey":
      return <FormIcon className={className} />;
    case "csv":
      return <FileSpreadsheetIcon className={className} />;
    default:
      return <FormIcon className={className} />;
  }
};

export const getFeedbackSourceTypeLabelKey = (type: TFeedbackSourceType): string => {
  switch (type) {
    case "formbricks_survey":
      return "workspace.unify.formbricks_surveys";
    case "csv":
      return "workspace.unify.csv_import";
    default:
      return type;
  }
};
