import { TFunction } from "i18next";
import { TSourceField } from "./types";

export interface TConnectorOption {
  id: string;
  name: string;
  description: string;
  disabled: boolean;
  badge?: { text: string; type: "success" | "gray" | "warning" };
}

export const getConnectorOptions = (t: TFunction): TConnectorOption[] => [
  {
    id: "formbricks",
    name: t("environments.unify.formbricks_surveys"),
    description: t("environments.unify.source_connect_formbricks_description"),
    disabled: false,
  },
  {
    id: "csv",
    name: t("environments.unify.csv_import"),
    description: t("environments.unify.source_connect_csv_description"),
    disabled: false,
  },
];

export const parseCSVColumnsToFields = (columns: string): TSourceField[] => {
  return columns.split(",").map((col) => {
    const trimmed = col.trim();
    return { id: trimmed, name: trimmed, type: "string", sampleValue: `Sample ${trimmed}` };
  });
};
