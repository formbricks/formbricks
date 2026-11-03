"use client";

import { CircleAlertIcon, InfoIcon } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { TCodeIssue } from "@formbricks/types/surveys/codes";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { isExternalImageSrc } from "@/lib/image-hosts";
import { CopyIdButton } from "@/modules/survey/editor/components/copy-id-button";
import { PublishedLockNotice } from "@/modules/survey/editor/components/published-lock-notice";
import { describeCodeIssue, getCodeClashLabel } from "@/modules/survey/editor/lib/code-messages";
import { getCopiedOptionsSource } from "@/modules/survey/editor/lib/copied-options-editing";
import {
  TCodeDraft,
  TOptionListKey,
  getCodeChangedNote,
  getElementCodeIssues,
  getOptionCodeLists,
  hasQuestionCode,
  optionIssueKey,
  resetElementCodes,
  setElementCode,
  setOptionCode,
  typeCode,
} from "@/modules/survey/editor/lib/element-codes";
import { NO_ELEMENT_LOCK, TElementLock } from "@/modules/survey/editor/lib/published-lock";
import { getElementBadgeText } from "@/modules/survey/lib/element-code-label";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface CodeFieldProps {
  id: string;
  value: string | undefined;
  issue: TCodeIssue | undefined;
  /** What a duplicate code clashes with, for the message ("Hip Hop"). */
  clashLabel?: string;
  kind: "question" | "answer";
  /** The published lock: the field is read-only and a lock icon inside it says why. */
  locked?: boolean;
  /**
   * A copied option's code (ENG-6938): read-only here, because it is the source option's, and this
   * note under the field names where it comes from.
   */
  readOnlyNote?: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  /** Sizes the input only: a message under it runs the full width of the row instead of wrapping. */
  inputClassName?: string;
  /**
   * Lays out `leading`, the input and `trailing` as one row (an answer code beside its option label
   * and copy button). Only this row is sized: the message under it still runs the full width.
   */
  rowClassName?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

/**
 * One code input. What is typed is tidied as it goes (lowercase, `_` for spaces, invalid characters
 * dropped), with a yellow note saying what it became, kept until the field loses focus. A problem that
 * cannot be tidied shows under the field in red, in the same words the publish check uses. A locked
 * field keeps its value, greyed, with the lock inside it. The root is `display: contents`: the input
 * (or its row) and the message under it are laid out by whatever column holds the field.
 */
export const CodeField = ({
  id,
  value,
  issue,
  clashLabel,
  kind,
  locked = false,
  readOnlyNote,
  onChange,
  ariaLabel,
  inputClassName,
  rowClassName,
  leading,
  trailing,
}: Readonly<CodeFieldProps>) => {
  const { t } = useTranslation();
  // What is typed while the field has focus. An empty field is not committed meanwhile: the editor
  // gives an uncoded question or option its default code at once, which would refill the field under
  // the cursor mid-edit.
  const [draft, setDraft] = useState<TCodeDraft | null>(null);
  const note = getCodeChangedNote(draft);
  return (
    <div className="contents">
      <div className={rowClassName ?? "contents"}>
        {leading}
        <div className={cn("relative", inputClassName)}>
          <Input
            id={id}
            disabled={locked || readOnlyNote !== undefined}
            value={draft?.value ?? value ?? ""}
            placeholder={t("workspace.surveys.edit.code_auto_placeholder")}
            aria-label={ariaLabel}
            aria-invalid={issue ? true : undefined}
            aria-describedby={issue ? `${id}-error` : undefined}
            isInvalid={Boolean(issue)}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              const next = typeCode(draft, event.target.value, kind);
              setDraft(next);
              if (next.value !== "") onChange(next.value);
            }}
            onBlur={() => {
              if (draft?.value === "") onChange("");
              setDraft(null);
            }}
            className={cn("h-9", locked && "pr-9", issue && "ring-1 ring-red-600")}
          />
          {locked && <PublishedLockNotice kind="code" className="absolute top-1.5 right-2" />}
        </div>
        {trailing}
      </div>
      {issue && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-sm font-medium text-red-800">
          <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
          {describeCodeIssue(issue, kind, t, clashLabel)}
        </p>
      )}
      {readOnlyNote && !issue && <p className="text-xs text-slate-500">{readOnlyNote}</p>}
      {note && !issue && (
        // <output> has the status role; aria-live is spelled out for readers that do not infer it.
        <output htmlFor={id} aria-live="polite" className="block text-sm text-amber-800">
          {t("workspace.surveys.edit.code_changed_to", { code: note })}
        </output>
      )}
    </div>
  );
};

interface RecodeSectionProps {
  element: TSurveyElement;
  elementIdx: number;
  localSurvey: TSurvey;
  lock?: TElementLock;
  updateElement: (elementIdx: number, updatedAttributes: Record<string, unknown>) => void;
}

/**
 * The Recode section of a question's Settings tab: the question code, the answer code of each option
 * (matrix rows and columns, picture selection) and "Reset all". Issues are derived from
 * `localSurvey` on every render, so a clash with a question in another block shows as you type.
 */
export const RecodeSection = ({
  element,
  elementIdx,
  localSurvey,
  lock = NO_ELEMENT_LOCK,
  updateElement,
}: Readonly<RecodeSectionProps>) => {
  const { t } = useTranslation();

  if (!hasQuestionCode(element)) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
        {t("workspace.surveys.edit.cta_has_no_question_code")}
      </p>
    );
  }

  const issues = getElementCodeIssues(localSurvey).get(element.id);
  const lists = getOptionCodeLists(element).filter(({ options }) => options.length > 0);
  const isRecodeLocked = lock.isActive && lock.isCodeLocked;
  const copied = getCopiedOptionsSource(localSurvey, element);

  return (
    <section
      className="flex flex-col gap-4 border-t border-slate-200 pt-4"
      aria-labelledby={`recode-${element.id}`}
      data-testid="recode">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h4 id={`recode-${element.id}`} className="text-sm font-medium text-slate-900">
            {t("workspace.surveys.edit.recode")}
          </h4>
          <p className="text-sm text-slate-500">
            {isRecodeLocked
              ? t("workspace.surveys.edit.recode_locked")
              : t("workspace.surveys.edit.recode_locks_on_publish")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isRecodeLocked}
          onClick={() => updateElement(elementIdx, resetElementCodes(element))}>
          {t("workspace.surveys.edit.reset_all_codes")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`code-${element.id}`}>{t("workspace.surveys.edit.question_code")}</Label>
        <CodeField
          id={`code-${element.id}`}
          kind="question"
          inputClassName="max-w-[300px]"
          locked={lock.isCodeLocked}
          value={"code" in element ? element.code : undefined}
          issue={issues?.question}
          clashLabel={issues?.question ? getCodeClashLabel(localSurvey, issues.question, t) : undefined}
          onChange={(value) => updateElement(elementIdx, setElementCode(value))}
        />
      </div>

      {lists.map(({ key, options }) => (
        <div key={key} className="flex flex-col gap-2">
          <Label>{optionListTitle(key, t)}</Label>
          <div className="flex flex-col gap-2">
            {options.map((option, optionIdx) => {
              const label = getLocalizedValue(option.label as never, "default");
              const shownLabel = label || optionFallbackLabel(key, optionIdx, t);
              const fieldId = `code-${element.id}-${key}-${option.id}`;
              const issue = issues?.options.get(optionIssueKey(key, option.id));
              return (
                <div key={option.id} className="flex flex-col gap-1">
                  <CodeField
                    id={fieldId}
                    kind="answer"
                    // The row is capped so the inputs line up; the message below it is not, so it
                    // runs the full width instead of wrapping inside the row.
                    rowClassName={cn(
                      "grid items-center gap-x-2",
                      option.imageUrl
                        ? "grid-cols-[80px_minmax(0,1fr)_108px_auto]"
                        : "grid-cols-[minmax(0,1fr)_204px_auto]",
                      key === "choices" ? "max-w-[400px]" : "max-w-[300px]"
                    )}
                    leading={
                      <>
                        {option.imageUrl && (
                          <Image
                            src={option.imageUrl}
                            alt=""
                            width={80}
                            height={45}
                            className="h-[45px] w-20 shrink-0 rounded-lg object-cover"
                            unoptimized={isExternalImageSrc(option.imageUrl)}
                          />
                        )}
                        <TooltipRenderer tooltipContent={shownLabel} triggerClass="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block h-9 truncate text-sm leading-9",
                              !label && "text-slate-400"
                            )}>
                            {shownLabel}
                          </span>
                        </TooltipRenderer>
                      </>
                    }
                    trailing={
                      key === "choices" && (
                        <CopyIdButton id={option.id} label={t("workspace.surveys.edit.copy_option_id")} />
                      )
                    }
                    locked={lock.isAnswerCodeLocked(key, option.id)}
                    readOnlyNote={
                      key === "choices" && copied?.copiedIds.has(option.id)
                        ? t("workspace.surveys.edit.copied_code_from", {
                            question: getElementBadgeText(copied.source),
                          })
                        : undefined
                    }
                    ariaLabel={shownLabel}
                    value={option.code}
                    issue={issue}
                    clashLabel={issue ? getCodeClashLabel(localSurvey, issue, t) : undefined}
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
  if (key === "rows") return t("workspace.surveys.edit.rows");
  if (key === "columns") return t("workspace.surveys.edit.columns");
  return t("workspace.surveys.edit.recode_options");
};
