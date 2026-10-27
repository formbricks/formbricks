"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { TCodeIssue } from "@formbricks/types/surveys/codes";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { isExternalImageSrc } from "@/lib/image-hosts";
import {
  TOptionListKey,
  describeCodeIssue,
  getElementCodeIssues,
  getOptionCodeLists,
  hasQuestionCode,
  optionIssueKey,
  resetElementCodes,
  setElementCode,
  setOptionCode,
} from "@/modules/survey/editor/lib/element-codes";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface CodeFieldProps {
  id: string;
  value: string | undefined;
  issue: TCodeIssue | undefined;
  kind: "question" | "answer";
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}

/** One code input with its error text. The text is the same one the publish check reports. */
export const CodeField = ({
  id,
  value,
  issue,
  kind,
  onChange,
  ariaLabel,
  className,
}: Readonly<CodeFieldProps>) => {
  const { t } = useTranslation();
  return (
    <div className={className}>
      <Input
        id={id}
        value={value ?? ""}
        placeholder={t("workspace.surveys.edit.code_auto_placeholder")}
        aria-label={ariaLabel}
        aria-invalid={issue ? true : undefined}
        aria-describedby={issue ? `${id}-error` : undefined}
        isInvalid={Boolean(issue)}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 font-mono"
      />
      {issue && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {describeCodeIssue(issue, kind, t)}
        </p>
      )}
    </div>
  );
};

interface RecodeSectionProps {
  element: TSurveyElement;
  elementIdx: number;
  localSurvey: TSurvey;
  updateElement: (elementIdx: number, updatedAttributes: Record<string, unknown>) => void;
}

/**
 * The Recode section of a question's Settings tab: the question code, the answer code of each option
 * (matrix rows and columns, picture selection) and "Reset all" on a draft. Issues are derived from
 * `localSurvey` on every render, so a clash with a question in another block shows as you type.
 */
export const RecodeSection = ({
  element,
  elementIdx,
  localSurvey,
  updateElement,
}: Readonly<RecodeSectionProps>) => {
  const { t } = useTranslation();

  if (!hasQuestionCode(element)) return null;

  const issues = getElementCodeIssues(localSurvey).get(element.id);
  const lists = getOptionCodeLists(element).filter(({ options }) => options.length > 0);
  const isDraft = localSurvey.status === "draft";

  return (
    <section
      className="flex flex-col gap-4 border-t border-slate-200 pt-4"
      aria-labelledby={`recode-${element.id}`}
      data-testid="recode">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 id={`recode-${element.id}`} className="text-sm font-semibold text-slate-800">
            {t("workspace.surveys.edit.recode")}
          </h4>
          <p className="text-xs text-slate-500">{t("workspace.surveys.edit.recode_description")}</p>
        </div>
        {isDraft && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => updateElement(elementIdx, resetElementCodes(element))}>
            {t("workspace.surveys.edit.reset_all_codes")}
          </Button>
        )}
      </div>

      <div>
        <Label htmlFor={`code-${element.id}`}>{t("workspace.surveys.edit.question_code")}</Label>
        <CodeField
          id={`code-${element.id}`}
          className="mt-2"
          kind="question"
          value={"code" in element ? element.code : undefined}
          issue={issues?.question}
          onChange={(value) => updateElement(elementIdx, setElementCode(value))}
        />
      </div>

      {lists.map(({ key, options }) => (
        <div key={key}>
          <Label>{optionListTitle(key, t)}</Label>
          <div className="mt-2 flex flex-col gap-2">
            {options.map((option, optionIdx) => {
              const label = getLocalizedValue(option.label as never, "default");
              const fieldId = `code-${element.id}-${key}-${option.id}`;
              return (
                <div key={option.id} className="grid grid-cols-[minmax(0,1fr)_10rem] items-start gap-3">
                  <div className="flex min-h-9 min-w-0 items-center gap-2 text-sm text-slate-700">
                    {option.imageUrl && (
                      <Image
                        src={option.imageUrl}
                        alt=""
                        width={48}
                        height={32}
                        className="h-8 w-12 shrink-0 rounded object-cover"
                        unoptimized={isExternalImageSrc(option.imageUrl)}
                      />
                    )}
                    <span className={cn("truncate", !label && "text-slate-400")}>
                      {label || optionFallbackLabel(key, optionIdx, t)}
                    </span>
                  </div>
                  <CodeField
                    id={fieldId}
                    kind="answer"
                    ariaLabel={label || optionFallbackLabel(key, optionIdx, t)}
                    value={option.code}
                    issue={issues?.options.get(optionIssueKey(key, option.id))}
                    onChange={(value) =>
                      updateElement(elementIdx, setOptionCode(element, key, option.id, value))
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
};

const optionFallbackLabel = (
  key: TOptionListKey,
  optionIdx: number,
  t: ReturnType<typeof useTranslation>["t"]
): string => {
  if (key === "rows") return t("common.row_n", { n: optionIdx + 1 });
  if (key === "columns") return t("common.column_n", { n: optionIdx + 1 });
  return t("common.choice_n", { n: optionIdx + 1 });
};

const optionListTitle = (key: TOptionListKey, t: ReturnType<typeof useTranslation>["t"]): string => {
  if (key === "rows") return t("workspace.surveys.edit.recode_row_codes");
  if (key === "columns") return t("workspace.surveys.edit.recode_column_codes");
  return t("workspace.surveys.edit.recode_answer_codes");
};
