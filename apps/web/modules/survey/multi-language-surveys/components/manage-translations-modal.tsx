"use client";

import { ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { type TranslatableString } from "../lib/types";
import {
  extractTranslatableStrings,
  getProgressColor,
  getProgressTextColor,
  setTranslationAtPathMutable,
} from "../lib/utils";
import { TranslationRow } from "./translation-row";

interface ManageTranslationsModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  languageCode: string;
  languageName: string;
  defaultLanguageName: string;
}

export const ManageTranslationsModal = ({
  open,
  setOpen,
  localSurvey,
  setLocalSurvey,
  languageCode,
  languageName,
  defaultLanguageName,
}: ManageTranslationsModalProps) => {
  const { t } = useTranslation();

  const strings = useMemo(() => extractTranslatableStrings(localSurvey, t), [localSurvey, t]);

  const [draftTranslations, setDraftTranslations] = useState<Record<string, string>>({});
  const [missingFirst, setMissingFirst] = useState(false);

  // Initialize drafts when modal opens
  useEffect(() => {
    if (open) {
      const drafts: Record<string, string> = {};
      for (const s of strings) {
        drafts[s.path] = s.value[languageCode] ?? "";
      }
      setDraftTranslations(drafts);
    }
  }, [open, strings, languageCode]);

  const isDraftEmpty = useCallback(
    (s: TranslatableString) => {
      const val = draftTranslations[s.path];
      if (val === undefined || val === "") return true;
      // Rich text editors output HTML like "<p></p>" when empty — strip tags before checking
      const text = s.isRichText ? getTextContent(val) : val;
      return !text.trim();
    },
    [draftTranslations]
  );

  const progress = useMemo(() => {
    const total = strings.length;
    if (total === 0) return { translated: 0, total: 0, percentage: 100 };
    const translated = strings.filter((s) => !isDraftEmpty(s)).length;
    const percentage = Math.round((translated / total) * 100);
    return { translated, total, percentage };
  }, [isDraftEmpty, strings]);

  // Snapshot the sort order so rows don't jump while the user is typing.
  // Re-sort only when the sort mode is toggled or the underlying strings change.
  const displayStrings = useMemo(() => {
    if (!missingFirst) return strings;
    return [...strings].sort((a, b) => {
      const aEmpty = isDraftEmpty(a);
      const bEmpty = isDraftEmpty(b);
      if (aEmpty && !bEmpty) return -1;
      if (!aEmpty && bEmpty) return 1;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strings, missingFirst]);

  // Merge draft translations into localSurvey so that the recall dropdown
  // can see in-progress translations (e.g. translated headlines).
  const mergedSurvey = useMemo(() => {
    const clone = structuredClone(localSurvey);
    for (const s of strings) {
      const val = draftTranslations[s.path] ?? "";
      if (val) {
        setTranslationAtPathMutable(clone, s.path, languageCode, val);
      }
    }
    return clone;
  }, [localSurvey, strings, draftTranslations, languageCode]);

  const handleDraftChange = useCallback((path: string, value: string) => {
    setDraftTranslations((prev) => ({ ...prev, [path]: value }));
  }, []);

  const handleSave = () => {
    const updatedSurvey = structuredClone(localSurvey);
    for (const s of strings) {
      const val = draftTranslations[s.path] ?? "";
      setTranslationAtPathMutable(updatedSurvey, s.path, languageCode, val);
    }
    setLocalSurvey(updatedSurvey);
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const progressColor = getProgressColor(progress.percentage);
  const progressTextColor = getProgressTextColor(progress.percentage);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent width="wide" className="max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle>{t("environments.surveys.edit.manage_translations")}</DialogTitle>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn("h-full rounded-full transition-all", progressColor)}
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <span className={cn("text-sm font-medium", progressTextColor)}>
                {progress.translated}/{progress.total}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="text-xs">
                  {missingFirst
                    ? t("environments.surveys.edit.missing_first")
                    : t("environments.surveys.edit.show_in_order")}
                  <ChevronDownIcon className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem
                  className={cn(!missingFirst && "font-semibold", "text-xs")}
                  onSelect={() => setMissingFirst(false)}>
                  {t("environments.surveys.edit.show_in_order")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(missingFirst && "font-semibold", "text-xs")}
                  onSelect={() => setMissingFirst(true)}>
                  {t("environments.surveys.edit.missing_first")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <DialogBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="w-16 py-2 pr-2 font-medium">{t("common.id")}</th>
                <th className="w-1/3 py-2 pr-2 font-medium">{defaultLanguageName}</th>
                <th className="py-2 font-medium">{languageName}</th>
              </tr>
            </thead>
            <tbody>
              {displayStrings.map((s) => (
                <TranslationRow
                  key={s.path}
                  s={s}
                  value={draftTranslations[s.path] ?? ""}
                  onChange={handleDraftChange}
                  localSurvey={mergedSurvey}
                  languageCode={languageCode}
                />
              ))}
            </tbody>
          </table>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" onClick={handleSave}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
