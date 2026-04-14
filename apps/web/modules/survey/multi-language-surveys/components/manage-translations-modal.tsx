"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { md } from "@/lib/markdownIt";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Editor } from "@/modules/ui/components/editor";
import { Input } from "@/modules/ui/components/input";
import {
  type TranslatableString,
  extractTranslatableStrings,
  getProgressColor,
  getProgressTextColor,
  setTranslationAtPath,
} from "../lib/translation-utils";

interface ManageTranslationsModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  languageCode: string;
  locale: TUserLocale;
}

export const ManageTranslationsModal = ({
  open,
  setOpen,
  localSurvey,
  setLocalSurvey,
  languageCode,
}: ManageTranslationsModalProps) => {
  const { t } = useTranslation();

  const strings = useMemo(() => extractTranslatableStrings(localSurvey), [localSurvey]);

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

  const displayStrings = useMemo(() => {
    if (!missingFirst) return strings;
    return [...strings].sort((a, b) => {
      const aEmpty = isDraftEmpty(a);
      const bEmpty = isDraftEmpty(b);
      if (aEmpty && !bEmpty) return -1;
      if (!aEmpty && bEmpty) return 1;
      return 0;
    });
  }, [strings, missingFirst, isDraftEmpty]);

  // Merge draft translations into localSurvey so that the recall dropdown
  // can see in-progress translations (e.g. translated headlines).
  const mergedSurvey = useMemo(() => {
    let survey = localSurvey;
    for (const s of strings) {
      const val = draftTranslations[s.path] ?? "";
      if (val) {
        survey = setTranslationAtPath(survey, s.path, languageCode, val);
      }
    }
    return survey;
  }, [localSurvey, strings, draftTranslations, languageCode]);

  const handleDraftChange = useCallback((path: string, value: string) => {
    setDraftTranslations((prev) => ({ ...prev, [path]: value }));
  }, []);

  const handleSave = () => {
    let updatedSurvey = localSurvey;
    for (const s of strings) {
      const val = draftTranslations[s.path] ?? "";
      updatedSurvey = setTranslationAtPath(updatedSurvey, s.path, languageCode, val);
    }
    setLocalSurvey(updatedSurvey);
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const progressColor = getProgressColor(progress.percentage);
  const progressTextColor = getProgressTextColor(progress.percentage);
  const isIncomplete = progress.percentage < 100;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent width="wide" className="max-h-[85dvh]">
        <DialogHeader>
          <DialogTitle>{t("environments.surveys.edit.manage_translations")}</DialogTitle>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span className={cn("font-medium", progressTextColor)}>
                {progress.translated}/{progress.total} ({progress.percentage}%)
              </span>
              {isIncomplete && (
                <button
                  type="button"
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                  onClick={() => setMissingFirst(!missingFirst)}>
                  {missingFirst
                    ? t("environments.surveys.edit.show_in_order")
                    : t("environments.surveys.edit.missing_first")}
                </button>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn("h-full rounded-full transition-all", progressColor)}
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="w-16 py-2 pr-2 font-medium">ID</th>
                <th className="w-1/3 py-2 pr-2 font-medium">{t("environments.surveys.edit.default_text")}</th>
                <th className="py-2 font-medium">{t("environments.surveys.edit.translation")}</th>
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

const TranslationRow = ({
  s,
  value,
  onChange,
  localSurvey,
  languageCode,
}: {
  s: TranslatableString;
  value: string;
  onChange: (path: string, value: string) => void;
  localSurvey: TSurvey;
  languageCode: string;
}) => {
  const isEmpty = !value.trim();
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-2 align-top">
        <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
          {s.displayId}
        </span>
        <div className="mt-0.5 text-[10px] text-slate-400">{s.fieldLabel}</div>
      </td>
      <td className="py-2 pr-2 align-top">
        {s.isRichText ? (
          <div
            className="text-sm text-slate-700"
            dangerouslySetInnerHTML={{ __html: s.value.default || "" }}
          />
        ) : (
          <div className="text-sm text-slate-700">{s.value.default || ""}</div>
        )}
      </td>
      <td className="py-2 align-top">
        {s.isRichText ? (
          <RichTextTranslationInput
            path={s.path}
            value={value}
            onChange={onChange}
            isEmpty={isEmpty}
            localSurvey={localSurvey}
            languageCode={languageCode}
            elementId={s.elementId}
          />
        ) : (
          <Input
            className={cn("text-sm", isEmpty && "border-orange-400 focus:border-orange-500")}
            value={value}
            onChange={(e) => onChange(s.path, e.target.value)}
            placeholder=""
          />
        )}
      </td>
    </tr>
  );
};

const RichTextTranslationInput = ({
  path,
  value,
  onChange,
  isEmpty,
  localSurvey,
  languageCode,
  elementId,
}: {
  path: string;
  value: string;
  onChange: (path: string, value: string) => void;
  isEmpty: boolean;
  localSurvey: TSurvey;
  languageCode: string;
  elementId: string;
}) => {
  const [firstRender, setFirstRender] = useState(true);

  return (
    <div className={cn("rounded-md", isEmpty && "ring-1 ring-orange-400")}>
      <Editor
        key={path}
        disableLists
        excludedToolbarItems={["blockType"]}
        firstRender={firstRender}
        setFirstRender={setFirstRender}
        getText={() => md.render(value)}
        setText={(v: string) => onChange(path, v)}
        localSurvey={localSurvey}
        elementId={elementId}
        selectedLanguageCode={languageCode}
      />
    </div>
  );
};
