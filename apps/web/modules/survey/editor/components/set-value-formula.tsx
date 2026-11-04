"use client";

import { AtSignIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import { getSurveyEmbeddedFields } from "@formbricks/types/embedded-data-resolver";
import type { TExpressionTypeIssue } from "@formbricks/types/surveys/expression-types";
import type { TExpression } from "@formbricks/types/surveys/expressions";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  FORMULA_CHIP_FUNCTIONS,
  FORMULA_FUNCTION_EXAMPLES,
  FORMULA_MAX_LENGTH,
  type TFormulaChipFunction,
  type TFormulaError,
  type TFormulaReference,
  formatFormula,
  formatReferenceToken,
  getFormulaExample,
  getFormulaIssues,
  getFormulaReferences,
  getFormulaToWriteOnBlur,
  getFunctionSnippet,
  getShownFormulaError,
  insertIntoFormula,
  parseFormula,
} from "@/modules/survey/editor/lib/expression-formula";
import { formatSampleResult, getSampleResult } from "@/modules/survey/editor/lib/expression-sample";
import { type TCaretCoordinates, getCaretCoordinates } from "@/modules/survey/editor/lib/textarea-caret";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { Textarea } from "@/modules/ui/components/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

const SET_VALUE_DOCS_URL = "https://formbricks.com/docs/surveys/general-features/set-value";

interface SetValueFormulaProps {
  readonly id: string;
  readonly localSurvey: TSurvey;
  readonly variableId: string;
  readonly expression: TExpression;
  /** The block the step runs after; answers from later blocks are not offered by `@`. */
  readonly scopeBlockIdx: number;
  readonly onExpressionChange: (expression: TExpression) => void;
  /** The action's ⋮ menu, beside the @ button on the box's top line. */
  readonly actionMenu?: ReactNode;
}

const isEmptyFormula = (expression: TExpression) => expression.type === "static" && expression.value === "";

/** The answers and fields `@` offers, grouped; the same list at the caret and at the @ button. */
const ReferenceMenuItems = ({
  groups,
  onPick,
}: {
  groups: { label: string; items: TFormulaReference[] }[];
  onPick: (reference: TFormulaReference) => void;
}) =>
  groups.map((group) => (
    <div key={group.label}>
      <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
      {group.items.map((reference) => (
        <DropdownMenuItem
          key={`${reference.leaf.type}:${reference.leaf.value}`}
          onClick={() => onPick(reference)}>
          <span className="font-mono text-xs">{formatReferenceToken(reference.token)}</span>
        </DropdownMenuItem>
      ))}
    </div>
  ));

/** How long typing has to pause before the box shows what is wrong with the formula. */
const FORMULA_PROBLEM_DELAY_MS = 800;

/**
 * The formula box of a Set value step or calculation (ENG-6935): typed text parsed into the expression
 * tree (the parser lives in the web app only), function chips and `@` to insert an answer or field at
 * the cursor, the problems a save would refuse, and the result for a sample response.
 */
export function SetValueFormula({
  id,
  localSurvey,
  variableId,
  expression,
  scopeBlockIdx,
  onExpressionChange,
  actionMenu,
}: SetValueFormulaProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Where the caret goes when the reference menu closes: after the picked reference, or back where it was.
  const caretAfterMenuRef = useRef<number | null>(null);
  const references = useMemo(() => getFormulaReferences(localSurvey), [localSurvey]);

  const formatted = isEmptyFormula(expression) ? "" : formatFormula(expression, references);
  const [text, setText] = useState(formatted);
  const [parseError, setParseError] = useState<TFormulaError | null>(null);
  // Which reference menu is open: the one at the caret (an `@` typed) or the one at the @ button.
  const [referenceMenu, setReferenceMenu] = useState<"caret" | "button" | null>(null);
  const isReferenceMenuOpen = referenceMenu !== null;
  // Where the caret menu opens, relative to the box: the line the `@` was typed on.
  const [caretAnchor, setCaretAnchor] = useState<TCaretCoordinates>({ top: 0, left: 0, height: 0 });
  // True from a keystroke until a short pause or a blur: problems wait until then, so the box doesn't
  // flash an error at every character of a formula still being typed.
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settleTyping = () => {
    clearTimeout(typingTimer.current);
    setIsTyping(false);
  };
  useEffect(() => () => clearTimeout(typingTimer.current), []);
  // The tree this box last wrote: a change from anywhere else (undo, another row) resets the text.
  const lastWritten = useRef(JSON.stringify(expression));

  useEffect(() => {
    const incoming = JSON.stringify(expression);
    if (incoming === lastWritten.current) return;
    lastWritten.current = incoming;
    setText(formatted);
    setParseError(null);
  }, [expression, formatted]);

  const targetDataType: TEmbeddedDataType | undefined = getSurveyEmbeddedFields(localSurvey).find(
    ({ field, link }) => field.source === "computed" && link.storageKey === variableId
  )?.field.dataType;

  const applyText = (nextText: string) => {
    setText(nextText);
    const parsed = parseFormula(nextText, references);
    const isEmpty = !parsed.ok && parsed.error.code === "empty";
    let next: TExpression | null = null;
    if (parsed.ok) next = parsed.expression;
    else if (isEmpty) next = { type: "static", value: "" };
    setParseError(parsed.ok || isEmpty ? null : parsed.error);
    if (!next) return;
    const serialized = JSON.stringify(next);
    if (serialized === lastWritten.current) return;
    lastWritten.current = serialized;
    onExpressionChange(next);
  };

  const insertAtCursor = (
    insert: string,
    options: { cursorOffset?: number; replaceTypedAt?: boolean } = {}
  ) => {
    const textarea = textareaRef.current;
    const selection = {
      start: textarea?.selectionStart ?? text.length,
      end: textarea?.selectionEnd ?? text.length,
    };
    const result = insertIntoFormula(text, selection, insert, options);
    applyText(result.text);
    caretAfterMenuRef.current = result.cursor;
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(result.cursor, result.cursor);
    });
  };

  const openReferenceMenu = (menu: "caret" | "button" | null) => {
    if (menu) caretAfterMenuRef.current = null;
    setReferenceMenu(menu);
  };

  /** Opens the menu at the caret, just after the `@` typed at `position`. */
  const openReferenceMenuAtCaret = (textarea: HTMLTextAreaElement, position: number) => {
    const caret = getCaretCoordinates(textarea, position);
    // Kept inside the box: a caret at the far right of a line would otherwise sit past its edge.
    setCaretAnchor({ ...caret, left: Math.min(caret.left, textarea.clientWidth) });
    openReferenceMenu("caret");
  };

  /** Back to the formula, not the @ button: typing carries on where it left off. */
  const returnFocusToFormula = (event: Event) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    event.preventDefault();
    const caret = caretAfterMenuRef.current ?? textarea.selectionEnd;
    caretAfterMenuRef.current = null;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  };

  const formulaIssues = useMemo(
    () =>
      !parseError && !isEmptyFormula(expression) ? getFormulaIssues(expression, variableId, localSurvey) : [],
    [parseError, expression, variableId, localSurvey]
  );

  const sampleResult =
    !parseError && formulaIssues.length === 0 && !isEmptyFormula(expression) && targetDataType
      ? getSampleResult(expression, targetDataType, localSurvey)
      : null;

  const describeParseError = (error: TFormulaError): string => {
    switch (error.code) {
      case "unexpected_token":
        return t("workspace.surveys.edit.flow.formula_error_unexpected_token", {
          detail: error.detail ?? "",
          position: error.position + 1,
        });
      case "unexpected_character":
        return t("workspace.surveys.edit.flow.formula_error_unexpected_character", {
          detail: error.detail ?? "",
        });
      case "unexpected_end":
        return t("workspace.surveys.edit.flow.formula_error_unexpected_end");
      case "unclosed_text":
        return t("workspace.surveys.edit.flow.formula_error_unclosed_text");
      case "unknown_function":
        return t("workspace.surveys.edit.flow.formula_error_unknown_function", { name: error.detail ?? "" });
      case "unknown_reference":
        return t("workspace.surveys.edit.flow.formula_error_unknown_reference", { name: error.detail ?? "" });
      case "incomplete_reference":
        return t("workspace.surveys.edit.flow.formula_error_incomplete_reference");
      case "too_long":
        return t("workspace.surveys.edit.flow.formula_error_too_long", { max: FORMULA_MAX_LENGTH });
      case "empty":
        return "";
    }
  };

  /** A type name in the author's language. Literal keys, so the translation scan sees them. */
  const describeValueType = (type: string | undefined): string => {
    switch (type) {
      case "number":
        return t("workspace.surveys.edit.flow.formula_type_number");
      case "date":
        return t("workspace.surveys.edit.flow.formula_type_date");
      case "boolean":
        return t("workspace.surveys.edit.flow.formula_type_boolean");
      default:
        return t("workspace.surveys.edit.flow.formula_type_text");
    }
  };

  /** What a function chip does, for its tooltip. Literal keys, so the translation scan sees them. */
  const describeFunction = (fn: TFormulaChipFunction): string => {
    switch (fn) {
      case "round":
        return t("workspace.surveys.edit.flow.formula_function_round");
      case "min":
        return t("workspace.surveys.edit.flow.formula_function_min");
      case "max":
        return t("workspace.surveys.edit.flow.formula_function_max");
      case "abs":
        return t("workspace.surveys.edit.flow.formula_function_abs");
      case "ifEmpty":
        return t("workspace.surveys.edit.flow.formula_function_if_empty");
      case "concat":
        return t("workspace.surveys.edit.flow.formula_function_concat");
      case "now":
        return t("workspace.surveys.edit.flow.formula_function_now");
      case "daysBetween":
        return t("workspace.surveys.edit.flow.formula_function_days_between");
    }
  };

  /** The save check's problem (the shared validator's), worded in the author's language. */
  const describeFormulaIssue = (issue: TExpressionTypeIssue): string => {
    const params = issue.params ?? {};
    switch (issue.code) {
      case "unknown_question":
        return t("workspace.surveys.edit.flow.formula_issue_unknown_question", { id: params.id ?? "" });
      case "unusable_question":
        return t("workspace.surveys.edit.flow.formula_issue_unusable_question", {
          questionType: params.questionType ?? "",
        });
      case "unknown_field":
        return t("workspace.surveys.edit.flow.formula_issue_unknown_field", { id: params.id ?? "" });
      case "needs_numbers":
        return t("workspace.surveys.edit.flow.formula_issue_needs_numbers", {
          fn: params.fn ?? "",
          got: describeValueType(params.got),
        });
      case "needs_type":
        return t("workspace.surveys.edit.flow.formula_issue_needs_type", {
          fn: params.fn ?? "",
          wanted: describeValueType(params.wanted),
          got: describeValueType(params.got),
        });
      case "fallback_mismatch":
        return t("workspace.surveys.edit.flow.formula_issue_fallback_mismatch", {
          wanted: describeValueType(params.wanted),
          got: describeValueType(params.got),
        });
      case "empty":
        return t("workspace.surveys.edit.flow.formula_issue_empty");
      case "target_not_formula":
        return t("workspace.surveys.edit.flow.formula_issue_target_not_formula", {
          fieldType: describeValueType(params.fieldType),
        });
      case "result_mismatch":
        return t("workspace.surveys.edit.flow.formula_issue_result_mismatch", {
          got: describeValueType(params.got),
          wanted: describeValueType(params.wanted),
        });
    }
  };

  const groups: { label: string; items: TFormulaReference[] }[] = [
    {
      label: t("common.questions"),
      items: references.filter(
        (reference) =>
          reference.group === "question" && reference.usable && (reference.blockIdx ?? 0) <= scopeBlockIdx
      ),
    },
    {
      label: t("common.embedded_data"),
      items: references.filter((reference) => reference.group === "field" && reference.usable),
    },
    {
      label: t("common.auto_captured"),
      items: references.filter((reference) => reference.group === "reserved"),
    },
  ].filter((group) => group.items.length > 0);

  // A reference being picked (the menu open, or an `@` just typed) is not a mistake yet.
  const shownParseError = parseError
    ? getShownFormulaError(parseError, { text, isReferenceMenuOpen, isTyping })
    : null;
  const shownIssue = isTyping ? undefined : formulaIssues[0];
  let problem: string | null = null;
  if (parseError) problem = shownParseError && describeParseError(shownParseError);
  else if (shownIssue) problem = describeFormulaIssue(shownIssue);
  const shownSample =
    sampleResult !== null && sampleResult !== "" && targetDataType
      ? formatSampleResult(sampleResult, targetDataType, locale)
      : null;

  const pickReference = (reference: TFormulaReference) =>
    insertAtCursor(formatReferenceToken(reference.token), { replaceTypedAt: true });

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="relative w-full">
          <Textarea
            id={id}
            ref={textareaRef}
            value={text}
            maxLength={FORMULA_MAX_LENGTH}
            rows={2}
            spellCheck={false}
            className="min-h-10 bg-white font-mono"
            placeholder={t("workspace.surveys.edit.flow.formula_placeholder", {
              example: getFormulaExample(references, scopeBlockIdx),
            })}
            aria-describedby={`${id}-hint`}
            aria-label={t("workspace.surveys.edit.flow.formula")}
            aria-invalid={problem ? true : undefined}
            isInvalid={Boolean(problem)}
            onBlur={() => {
              settleTyping();
              // A formula left half-typed must not keep the last one that parsed: Publish would ship it.
              // Focus moving into the reference menu is a reference being picked, not the box left.
              if (isReferenceMenuOpen) return;
              const onBlurExpression = getFormulaToWriteOnBlur(text, references);
              if (!onBlurExpression) return;
              const serialized = JSON.stringify(onBlurExpression);
              if (serialized === lastWritten.current) return;
              lastWritten.current = serialized;
              onExpressionChange(onBlurExpression);
            }}
            onChange={(event) => {
              const nextText = event.target.value;
              setIsTyping(true);
              clearTimeout(typingTimer.current);
              typingTimer.current = setTimeout(() => setIsTyping(false), FORMULA_PROBLEM_DELAY_MS);
              applyText(nextText);
              const cursor = event.target.selectionStart;
              if (nextText.length > text.length && nextText[cursor - 1] === "@") {
                openReferenceMenuAtCaret(event.target, cursor);
              }
            }}
          />
          {/* A typed `@` opens the menu where it was typed: this invisible trigger sits on the caret's
              line, so the menu opens under it rather than at the box's edge. */}
          <DropdownMenu
            open={referenceMenu === "caret"}
            onOpenChange={(open) => openReferenceMenu(open ? "caret" : null)}>
            <DropdownMenuTrigger asChild>
              <span
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none absolute w-0"
                style={{ top: caretAnchor.top, left: caretAnchor.left, height: caretAnchor.height }}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-72 overflow-y-auto"
              onCloseAutoFocus={returnFocusToFormula}>
              <ReferenceMenuItems groups={groups} onPick={pickReference} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <DropdownMenu
          open={referenceMenu === "button"}
          onOpenChange={(open) => openReferenceMenu(open ? "button" : null)}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              className="size-10 shrink-0"
              title={t("workspace.surveys.edit.flow.formula_insert_reference")}
              aria-label={t("workspace.surveys.edit.flow.formula_insert_reference")}>
              <AtSignIcon />
            </Button>
          </DropdownMenuTrigger>
          {/* Closing returns to the formula rather than the button, so a space typed next doesn't
              reopen the menu. */}
          <DropdownMenuContent
            align="end"
            className="max-h-72 overflow-y-auto"
            onCloseAutoFocus={returnFocusToFormula}>
            <ReferenceMenuItems groups={groups} onPick={pickReference} />
          </DropdownMenuContent>
        </DropdownMenu>
        {actionMenu}
      </div>

      <p id={`${id}-hint`} className="text-xs text-slate-500">
        {t("workspace.surveys.edit.flow.formula_hint")}{" "}
        <a
          href={SET_VALUE_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
          {t("common.learn_more")}
        </a>
      </p>

      <TooltipProvider delayDuration={300}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">{t("workspace.surveys.edit.flow.formula_functions")}</span>
          {FORMULA_CHIP_FUNCTIONS.map((fn) => (
            <Tooltip key={fn}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700 hover:bg-slate-100 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-hidden"
                  onClick={() => {
                    const snippet = getFunctionSnippet(fn);
                    insertAtCursor(snippet.text, { cursorOffset: snippet.cursorOffset });
                  }}>
                  {fn}()
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64 text-xs">
                <p>{describeFunction(fn)}</p>
                <p className="mt-1 font-mono text-slate-500">{FORMULA_FUNCTION_EXAMPLES[fn]}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {problem && (
        <p className="text-xs text-red-600" role="alert">
          {problem}
        </p>
      )}
      {!problem && sampleResult !== null && (
        <p className="text-xs text-slate-600" title={t("workspace.surveys.edit.flow.formula_sample_hint")}>
          {shownSample ? (
            <span title={shownSample.title}>
              {t("workspace.surveys.edit.flow.formula_sample_result", { result: shownSample.text })}
            </span>
          ) : (
            t("workspace.surveys.edit.flow.formula_sample_empty")
          )}
        </p>
      )}
    </div>
  );
}
