"use client";

import { PencilIcon } from "lucide-react";
import { type SubmitEvent, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useRenameEmbeddedField } from "@/modules/ee/analysis/charts/hooks/use-rename-embedded-field";
import { getChartApiErrorMessage } from "@/modules/ee/analysis/lib/api-client";
import {
  MAX_EMBEDDED_FIELD_LABEL_LENGTH,
  getEmbeddedFieldDisplayName,
} from "@/modules/ee/analysis/lib/embedded-field-label-limits";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/field-catalog";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

interface EmbeddedFieldRenameButtonProps {
  workspaceId: string;
  field: TEmbeddedChartField;
  /** Called once the new name is saved, e.g. to re-run the preview so its legend shows it. */
  onRenamed?: () => void;
}

/**
 * The ✎ on an imported field's chip: renames the key across the workspace. Built-in fields have none —
 * they keep their translated names.
 */
export function EmbeddedFieldRenameButton({
  workspaceId,
  field,
  onRenamed,
}: Readonly<EmbeddedFieldRenameButtonProps>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  // The stored name as the editor saw it when the popover opened. Read again at save time it would be the
  // refreshed name after a 409, and a retry would then overwrite exactly the rename the 409 protected.
  const [expectedLabel, setExpectedLabel] = useState<string | null>(null);
  const rename = useRenameEmbeddedField(workspaceId);
  const shownName = getEmbeddedFieldDisplayName(field);

  const save = (label: string) =>
    rename.mutate(
      { key: field.key, label, expectedLabel },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success(t("workspace.analysis.charts.rename_field_success"));
          onRenamed?.();
        },
        onError: (error) =>
          toast.error(getChartApiErrorMessage(error, t("workspace.analysis.charts.rename_field_failed"))),
      }
    );

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    save(draft);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(shownName);
      setExpectedLabel(field.label ?? null);
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("workspace.analysis.charts.rename_field", { field: shownName })}
          className="ring-offset-background ml-1 rounded-full outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
          // The chip list's command root cancels every Enter before it can click this trigger, so open on
          // Enter here, as the chip's remove button handles Enter itself.
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleOpenChange(true);
            }
          }}
          // Keep the chip list's own input from taking focus, as its remove button does.
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}>
          <PencilIcon className="text-muted-foreground hover:text-foreground size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80"
        // The popover is portalled, but React still bubbles its events to the chip list: keep Backspace in
        // this input from removing the last chosen field there.
        onKeyDown={(event) => event.stopPropagation()}>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label htmlFor={`rename-${field.name}`}>{t("workspace.analysis.charts.rename_field_name")}</Label>
            <Input
              id={`rename-${field.name}`}
              value={draft}
              maxLength={MAX_EMBEDDED_FIELD_LABEL_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
            />
            <p className="text-xs text-slate-500">
              {t("workspace.analysis.charts.rename_field_description", { key: field.key })}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            {field.label !== undefined && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={rename.isPending}
                onClick={() => save("")}>
                {t("workspace.analysis.charts.rename_field_reset")}
              </Button>
            )}
            <Button type="submit" size="sm" loading={rename.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
