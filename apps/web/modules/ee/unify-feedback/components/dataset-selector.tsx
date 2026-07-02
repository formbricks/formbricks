"use client";

import { useTranslation } from "react-i18next";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface DatasetSelectorProps {
  datasets: { id: string; name: string }[];
  selectedId: string;
  onChange: (id: string) => void;
}

/**
 * Org-scoped dataset picker for the Feedback Records view. Unlike the dead {@link file://./frd-picker.tsx}
 * reference it takes no workspace context — the datasets are supplied by the SSR page. Follows the same
 * 0/1/many shape: nothing to pick when there are fewer than two datasets, a Select otherwise.
 */
export const DatasetSelector = ({ datasets, selectedId, onChange }: Readonly<DatasetSelectorProps>) => {
  const { t } = useTranslation();

  // 0 datasets: the page renders an empty state instead. 1 dataset: it's implied by the header, so the
  // selector stays hidden.
  if (datasets.length < 2) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="dataset-selector">{t("workspace.unify.dataset_selector_label")}</Label>
      <Select value={selectedId} onValueChange={onChange}>
        <SelectTrigger id="dataset-selector" className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {datasets.map((dataset) => (
            <SelectItem key={dataset.id} value={dataset.id}>
              {dataset.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
