"use client";

import { type SyntheticEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { getChipParts } from "../lib/chip-label";
import { getOperatorName } from "../lib/operators";
import {
  type TRuleDraft,
  draftFromRule,
  draftToRule,
  getPopoverValueControl,
  switchDraftOperator,
} from "../lib/simple-rule";
import type { TFilterProperty, TRuleOperator, TTableFilter } from "../lib/types";
import { FilterChip } from "./filter-chip";
import { RuleValueInput } from "./rule-value-input";

const isSameRule = (a: TTableFilter, b: TTableFilter | undefined) =>
  a.property === b?.property &&
  a.operator === b.operator &&
  a.values.length === b.values.length &&
  a.values.every((value, index) => value === b.values[index]);

/** The chip a draft shows while its popover is open: the property and operator, with what is picked so far. */
const draftAsFilter = (property: TFilterProperty, draft: TRuleDraft): TTableFilter => ({
  property: property.id,
  operator: draft.operator || (property.ruleOperators?.[0] ?? "equals"),
  values: draft.values.length > 0 ? draft.values : [draft.value].filter(Boolean),
});

/** One rule's operator and value, in its chip's popover. */
const RuleEditor = ({
  property,
  draft,
  onDraftChange,
  invalid,
  onSubmit,
}: Readonly<{
  property: TFilterProperty;
  draft: TRuleDraft;
  onDraftChange: (draft: TRuleDraft) => void;
  invalid: boolean;
  onSubmit: () => void;
}>) => {
  const { t } = useTranslation();
  const valueId = useId();
  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <p className="truncate text-xs font-semibold text-slate-800">{property.label}</p>
      <Select
        value={draft.operator}
        onValueChange={(operator) =>
          onDraftChange(switchDraftOperator(property, draft, operator as TRuleOperator))
        }>
        <SelectTrigger className="bg-white" aria-label={t("common.table_toolbar.select_operator")}>
          <SelectValue placeholder={t("common.table_toolbar.select_operator")} />
        </SelectTrigger>
        <SelectContent>
          {(property.ruleOperators ?? []).map((operator) => (
            <SelectItem key={operator} value={operator}>
              {getOperatorName(operator, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <RuleValueInput
        id={valueId}
        property={property}
        operator={draft.operator}
        control={getPopoverValueControl(property, draft.operator)}
        value={draft.value}
        values={draft.values}
        invalid={invalid}
        onChange={(value) => onDraftChange({ ...draft, value })}
        onValuesChange={(values) => onDraftChange({ ...draft, values })}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm">
          {t("common.done")}
        </Button>
      </div>
    </form>
  );
};

/**
 * A rule's chip whose body opens one rule's operator and value in a popover (TableToolbar
 * `filter.simpleRules`), rather than the whole Advanced filter. Without `rule` it is a new rule's draft:
 * the chip shows what is picked so far and `onClose` drops it. Done, or a click outside, saves a finished
 * rule; an unfinished one is never saved, and Escape leaves the rule as it was.
 */
export const RuleFilterChip = ({
  property,
  rule,
  defaultOpen = false,
  onCommit,
  onRemove,
  onClose,
  disabled,
}: Readonly<{
  property: TFilterProperty;
  rule?: TTableFilter;
  defaultOpen?: boolean;
  onCommit: (rule: TTableFilter) => void;
  onRemove: () => void;
  onClose?: () => void;
  disabled?: boolean;
}>) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState(() => draftFromRule(property, rule));
  const [invalid, setInvalid] = useState(false);
  const parts = getChipParts(
    rule ?? draftAsFilter(property, draft),
    property,
    t,
    i18n.resolvedLanguage ?? i18n.language ?? "en-US"
  );

  const close = () => {
    setIsOpen(false);
    onClose?.();
  };

  const save = (keepOpenIfUnfinished: boolean) => {
    const next = draftToRule(property, draft);
    if (!next && keepOpenIfUnfinished) {
      setInvalid(true);
      return;
    }
    if (next && !isSameRule(next, rule)) onCommit(next);
    close();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      save(false);
      return;
    }
    setDraft(draftFromRule(property, rule));
    setInvalid(false);
    setIsOpen(true);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <FilterChip {...parts} disabled={disabled} onRemove={rule ? onRemove : close} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-3"
        aria-label={t("common.table_toolbar.edit_filter", { filter: property.label })}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          close();
        }}>
        <RuleEditor
          property={property}
          draft={draft}
          onDraftChange={(next) => {
            setDraft(next);
            setInvalid(false);
          }}
          invalid={invalid}
          onSubmit={() => save(true)}
        />
      </PopoverContent>
    </Popover>
  );
};
