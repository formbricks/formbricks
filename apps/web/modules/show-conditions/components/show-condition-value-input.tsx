"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TShowConditionSingle } from "@formbricks/types/show-conditions";
import { MAX_UNIQUE_PAGES } from "@formbricks/types/show-conditions-evaluate";
import type { TShowConditionUpdate } from "@/modules/show-conditions/lib/tree";
import { parseListInput } from "@/modules/show-conditions/lib/value-input";
import { Input } from "@/modules/ui/components/input";
import { Textarea } from "@/modules/ui/components/textarea";

interface ShowConditionValueInputProps {
  condition: TShowConditionSingle;
  onUpdate: (update: TShowConditionUpdate) => void;
  isReadOnly: boolean;
}

const LIST_OPERATORS = new Set(["containsAnyOf", "containsNoneOf", "pathIsAnyOf", "pathIsNoneOf"]);
const PATH_LIST_OPERATORS = new Set(["pathIsAnyOf", "pathIsNoneOf"]);
const PRESENCE_OPERATORS = new Set(["isSet", "isNotSet"]);

/**
 * The pasted list. The raw text is kept locally because the stored value drops blank lines: deriving
 * the text back from the list would swallow the newline the author just typed. Remounted per
 * condition (`key`), so a duplicate or an operand change starts from the stored list.
 */
const ListValueInput = ({ condition, onUpdate, isReadOnly }: Readonly<ShowConditionValueInputProps>) => {
  const { t } = useTranslation();
  const stored = condition.rightOperand?.value;
  const [text, setText] = useState(Array.isArray(stored) ? stored.join("\n") : "");
  // Say what a line matches: an exact list and a "contains" list look the same but match differently.
  const isPathList = PATH_LIST_OPERATORS.has(condition.operator);
  const hint = isPathList
    ? t("workspace.surveys.edit.show_conditions.list_hint_path")
    : t("workspace.surveys.edit.show_conditions.list_hint_contains");

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        rows={4}
        value={text}
        disabled={isReadOnly}
        className="min-h-24 resize-y bg-white font-mono text-xs"
        placeholder={
          isPathList
            ? t("workspace.surveys.edit.show_conditions.list_placeholder_path")
            : t("workspace.surveys.edit.show_conditions.list_placeholder")
        }
        aria-label={hint}
        onChange={(event) => {
          setText(event.target.value);
          const entries = parseListInput(event.target.value);
          onUpdate({ rightOperand: entries.length > 0 ? { value: entries } : undefined });
        }}
      />
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
};

const UNIT_LABEL_KEYS = {
  pagesViewed: "pages",
  uniquePagesViewed: "pages",
  timeOnSite: "seconds",
  screenWidth: "px",
} as const;

const NumberValueInput = ({ condition, onUpdate, isReadOnly }: Readonly<ShowConditionValueInputProps>) => {
  const { t } = useTranslation();
  const value = condition.rightOperand?.value;
  const unit = UNIT_LABEL_KEYS[condition.leftOperand.value as keyof typeof UNIT_LABEL_KEYS];
  // The visit store remembers this many different pages, so a higher number could never be reached.
  const max = condition.leftOperand.value === "uniquePagesViewed" ? MAX_UNIQUE_PAGES : Infinity;
  const unitLabel = {
    pages: t("workspace.surveys.edit.show_conditions.unit_pages"),
    seconds: t("workspace.surveys.edit.show_conditions.unit_seconds"),
    px: t("workspace.surveys.edit.show_conditions.unit_px"),
  }[unit];

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        max={Number.isFinite(max) ? max : undefined}
        className="bg-white"
        disabled={isReadOnly}
        value={typeof value === "number" ? value : ""}
        aria-label={unitLabel}
        onChange={(event) =>
          onUpdate({
            rightOperand:
              event.target.value === ""
                ? undefined
                : { value: Math.min(max, Math.max(0, Number(event.target.value))) },
          })
        }
      />
      <span className="shrink-0 text-sm text-slate-500">{unitLabel}</span>
    </div>
  );
};

const TextValueInput = ({
  condition,
  onUpdate,
  isReadOnly,
  placeholder,
}: Readonly<ShowConditionValueInputProps & { placeholder?: string }>) => {
  const { t } = useTranslation();
  const value = condition.rightOperand?.value;

  return (
    <Input
      className="bg-white"
      disabled={isReadOnly}
      value={typeof value === "string" ? value : ""}
      placeholder={placeholder ?? t("workspace.surveys.edit.show_conditions.value_placeholder")}
      onChange={(event) =>
        onUpdate({ rightOperand: event.target.value === "" ? undefined : { value: event.target.value } })
      }
    />
  );
};

/** Visited URL is one exact page, like the path lists, which a bare text box would not tell the author. */
const VisitedUrlValueInput = (props: Readonly<ShowConditionValueInputProps>) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <TextValueInput
        {...props}
        placeholder={t("workspace.surveys.edit.show_conditions.visited_url_placeholder")}
      />
      <p className="text-xs text-slate-500">{t("workspace.surveys.edit.show_conditions.visited_url_hint")}</p>
    </div>
  );
};

/** A query parameter needs its name as well as the value; `isSet` / `isNotSet` take the name only. */
const QueryParamValueInput = (props: Readonly<ShowConditionValueInputProps>) => {
  const { t } = useTranslation();
  const { condition, onUpdate, isReadOnly } = props;

  return (
    <div className="flex flex-col gap-2">
      <Input
        className="bg-white"
        disabled={isReadOnly}
        value={condition.leftOperand.meta?.key ?? ""}
        placeholder={t("workspace.surveys.edit.show_conditions.query_parameter_name_placeholder")}
        aria-label={t("workspace.surveys.edit.show_conditions.query_parameter_name_placeholder")}
        onChange={(event) =>
          onUpdate({ leftOperand: { value: "queryParam", meta: { key: event.target.value } } })
        }
      />
      {!PRESENCE_OPERATORS.has(condition.operator) && <TextValueInput {...props} />}
    </div>
  );
};

export const ShowConditionValueInput = (props: Readonly<ShowConditionValueInputProps>) => {
  const { condition } = props;
  if (condition.leftOperand.value === "queryParam") return <QueryParamValueInput {...props} />;
  if (condition.leftOperand.value === "visitedUrls") return <VisitedUrlValueInput {...props} />;
  if (LIST_OPERATORS.has(condition.operator)) return <ListValueInput {...props} />;
  if (typeof condition.rightOperand?.value === "number" || condition.leftOperand.value in UNIT_LABEL_KEYS) {
    return <NumberValueInput {...props} />;
  }
  return <TextValueInput {...props} />;
};
