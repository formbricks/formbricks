"use client";

import { useTranslation } from "react-i18next";
import { Alert } from "@/modules/ui/components/alert";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface FrdPickerProps {
  directories: { id: string; name: string }[];
  selectedDirectoryId: string | null;
  onChange: (id: string) => void;
  workspaceId: string;
}

export const FrdPicker = ({ directories, selectedDirectoryId, onChange, workspaceId }: FrdPickerProps) => {
  const { t } = useTranslation();

  if (directories.length === 0) {
    return (
      <Alert variant="error" size="small">
        <div>
          <p>{t("workspace.analysis.charts.no_data_source_available")}</p>
          <a
            className="mt-1 inline-block font-medium underline"
            href={`/workspaces/${workspaceId}/settings/feedback-directories`}>
            {t("workspace.analysis.charts.go_to_feedback_directories")}
          </a>
        </div>
      </Alert>
    );
  }

  if (directories.length === 1) {
    return (
      <div className="space-y-2">
        <Label>{t("workspace.analysis.charts.data_source")}</Label>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {directories[0].name}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-1">
      <Label htmlFor="feedbackDirectory">{t("workspace.analysis.charts.data_source")}</Label>
      <Select value={selectedDirectoryId ?? ""} onValueChange={onChange}>
        <SelectTrigger id="feedbackDirectory">
          <SelectValue placeholder={t("workspace.analysis.charts.select_data_source")} />
        </SelectTrigger>
        <SelectContent>
          {directories.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
