import { type TWorkflowEmailRecipient, isVariableEmailRecipient } from "@formbricks/workflows";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";
import type { TWorkflowVariableGroup } from "@/modules/ee/workflows/lib/variable-picker";

/**
 * The Send email recipient select (ENG-7182): survey fields and members as before, plus — for a
 * Webhook workflow — an address read from a Variable (`{type: "variable", ref}`, ENG-7169). A Select
 * holds strings, so a Variable recipient is the option value `variable:<path>`.
 */

const VARIABLE_PREFIX = "variable:";

export interface TRecipientVariableOption {
  value: string;
  label: string;
}

export const toRecipientSelectValue = (to: TWorkflowEmailRecipient): string =>
  isVariableEmailRecipient(to) ? `${VARIABLE_PREFIX}${to.ref}` : to;

export const fromRecipientSelectValue = (value: string): TWorkflowEmailRecipient =>
  value.startsWith(VARIABLE_PREFIX) ? { type: "variable", ref: value.slice(VARIABLE_PREFIX.length) } : value;

/**
 * The Variables an address can come from: text Variables of the payload and of earlier steps. The
 * current one stays listed when the sample no longer has it, so the field still shows what it sends to.
 */
export const getRecipientVariableOptions = (
  groups: readonly TWorkflowVariableGroup[],
  current: TWorkflowEmailRecipient
): TRecipientVariableOption[] => {
  const options = groups
    .filter((group) => group.kind === "payload" || group.kind === "step")
    .flatMap((group) => group.options)
    .filter((option) => option.isPickable && option.typeHint === "text")
    .map((option) => ({ value: `${VARIABLE_PREFIX}${option.path}`, label: `@${option.label}` }));

  if (isVariableEmailRecipient(current)) {
    const currentValue = toRecipientSelectValue(current);
    if (!options.some((option) => option.value === currentValue)) {
      options.push({ value: currentValue, label: `@${getVariableDisplayName(current.ref)}` });
    }
  }
  return options;
};
