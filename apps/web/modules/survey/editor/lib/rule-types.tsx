import type { TFunction } from "i18next";
import {
  AsteriskIcon,
  EqualIcon,
  type LucideIcon,
  type LucideProps,
  ShieldAlertIcon,
  SplitIcon,
} from "lucide-react";
import { forwardRef } from "react";
import type { TSurveyBlockLogicActionObjective } from "@formbricks/types/surveys/blocks";
import { cn } from "@/lib/cn";
import type { TFlowRuleType } from "@/modules/survey/editor/lib/flow-outline";

/**
 * One name, icon and colour per rule type (UX review #11), used by the rule's row, the Add logic
 * menu and the "then" dropdown, so a type is recognisable wherever it shows. The row's colours are
 * the FlowOutline tone of the same name.
 */

/** The order the menus list them in. */
export const RULE_TYPES: readonly TFlowRuleType[] = ["jump", "setValue", "requireAnswer", "markLowQuality"];

export const RULE_TYPE_OBJECTIVE: Record<TFlowRuleType, TSurveyBlockLogicActionObjective> = {
  jump: "jumpToBlock",
  setValue: "calculate",
  requireAnswer: "requireAnswer",
  markLowQuality: "markLowQuality",
};

const RULE_TYPE_ICON: Record<TFlowRuleType, LucideIcon> = {
  jump: SplitIcon,
  setValue: EqualIcon,
  requireAnswer: AsteriskIcon,
  markLowQuality: ShieldAlertIcon,
};

/** The type's colour, on the white tile icon's background and on a plain icon. */
const RULE_TYPE_COLOR: Record<TFlowRuleType, { tile: string; text: string }> = {
  jump: { tile: "bg-blue-500", text: "text-blue-500" },
  setValue: { tile: "bg-emerald-500", text: "text-emerald-500" },
  requireAnswer: { tile: "bg-violet-500", text: "text-violet-500" },
  markLowQuality: { tile: "bg-orange-500", text: "text-orange-500" },
};

export const getRuleTypeLabel = (type: TFlowRuleType, t: TFunction): string => {
  switch (type) {
    case "jump":
      return t("workspace.surveys.edit.jump_to_block");
    case "setValue":
      return t("workspace.surveys.edit.flow.set_value");
    case "requireAnswer":
      return t("workspace.surveys.edit.require_answer");
    case "markLowQuality":
      return t("workspace.surveys.edit.mark_as_low_quality");
  }
};

/** The type's icon, uncoloured: the row's tile colours it. */
export const RuleTypeIcon = ({
  type,
  className,
}: {
  readonly type: TFlowRuleType;
  readonly className?: string;
}) => {
  const Icon = RULE_TYPE_ICON[type];
  return <Icon className={className} aria-hidden="true" />;
};

/** The row's tile at menu size: the type's icon, white on its colour. */
export const RuleTypeTile = ({ type }: { readonly type: TFlowRuleType }) => (
  <span
    className={cn(
      "inline-flex size-5 shrink-0 items-center justify-center rounded-md text-white [&_svg]:size-3.5",
      RULE_TYPE_COLOR[type].tile
    )}
    aria-hidden="true">
    <RuleTypeIcon type={type} />
  </span>
);

const coloredIcon = (type: TFlowRuleType) => {
  const Icon = RULE_TYPE_ICON[type];
  const Colored = forwardRef<SVGSVGElement, LucideProps>(({ className, ...props }, ref) => (
    <Icon ref={ref} className={cn(className, RULE_TYPE_COLOR[type].text)} {...props} />
  ));
  Colored.displayName = `RuleTypeIcon(${type})`;
  return Colored;
};

/** For a combobox option's `icon`, which takes a component: the type's icon in its colour. */
export const RULE_TYPE_COMBOBOX_ICON = Object.fromEntries(
  RULE_TYPES.map((type) => [type, coloredIcon(type)])
) as Record<TFlowRuleType, ReturnType<typeof coloredIcon>>;
