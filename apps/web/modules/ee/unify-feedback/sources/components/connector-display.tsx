"use client";

import { FileSpreadsheetIcon, FormIcon } from "lucide-react";
import { TConnectorType } from "@formbricks/types/connector";

export const getConnectorIcon = (type: TConnectorType, className: string) => {
  switch (type) {
    case "formbricks_survey":
      return <FormIcon className={className} />;
    case "csv":
      return <FileSpreadsheetIcon className={className} />;
    default:
      return <FormIcon className={className} />;
  }
};

export const getConnectorTypeLabelKey = (type: TConnectorType): string => {
  switch (type) {
    case "formbricks_survey":
      return "workspace.unify.formbricks_surveys";
    case "csv":
      return "workspace.unify.csv_import";
    default:
      return type;
  }
};
