"use client";

import { createId } from "@paralleldrive/cuid2";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
    APPLICABLE_RULES,
    TValidationRule,
    TValidationRuleType,
} from "@formbricks/types/surveys/validation-rules";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/modules/ui/components/select";

interface ValidationRulesEditorProps {
    elementType: TSurveyElementTypeEnum;
    validationRules: TValidationRule[];
    onUpdateRules: (rules: TValidationRule[]) => void;
}

// Rule type definitions with labels and whether they need a value input
const RULE_TYPE_CONFIG: Record<
    TValidationRuleType,
    {
        label: string;
        needsValue: boolean;
        valueType?: "number" | "text";
        valuePlaceholder?: string;
        unitOptions?: { value: string; label: string }[];
    }
> = {
    required: {
        label: "Is not empty",
        needsValue: false,
    },
    minLength: {
        label: "Is longer than",
        needsValue: true,
        valueType: "number",
        valuePlaceholder: "100",
        unitOptions: [
            { value: "characters", label: "characters" },
        ],
    },
    maxLength: {
        label: "Is shorter than",
        needsValue: true,
        valueType: "number",
        valuePlaceholder: "500",
        unitOptions: [
            { value: "characters", label: "characters" },
        ],
    },
    pattern: {
        label: "Matches pattern",
        needsValue: true,
        valueType: "text",
        valuePlaceholder: "^[A-Z].*",
    },
    email: {
        label: "Is valid email",
        needsValue: false,
    },
    url: {
        label: "Is valid URL",
        needsValue: false,
    },
    phone: {
        label: "Is valid phone",
        needsValue: false,
    },
    minValue: {
        label: "Is greater than",
        needsValue: true,
        valueType: "number",
        valuePlaceholder: "0",
    },
    maxValue: {
        label: "Is less than",
        needsValue: true,
        valueType: "number",
        valuePlaceholder: "100",
    },
    minSelections: {
        label: "At least",
        needsValue: true,
        valueType: "number",
        valuePlaceholder: "1",
        unitOptions: [{ value: "options", label: "options selected" }],
    },
    maxSelections: {
        label: "At most",
        needsValue: true,
        valueType: "number",
        valuePlaceholder: "3",
        unitOptions: [{ value: "options", label: "options selected" }],
    },
};

// Get available rule types for an element type
const getAvailableRuleTypes = (
    elementType: TSurveyElementTypeEnum,
    existingRules: TValidationRule[]
): TValidationRuleType[] => {
    const elementTypeKey = elementType.toString();
    const applicable = APPLICABLE_RULES[elementTypeKey] ?? [];

    // Filter out rules that are already added (for non-repeatable rules)
    const existingTypes = new Set(existingRules.map((r) => r.params.type));

    return applicable.filter((ruleType) => {
        // Allow only one of each rule type
        return !existingTypes.has(ruleType);
    });
};

// Get the value from rule params based on rule type
const getRuleValue = (rule: TValidationRule): number | string | undefined => {
    const params = rule.params as Record<string, unknown>;
    if ("min" in params) return params.min as number;
    if ("max" in params) return params.max as number;
    if ("pattern" in params) return params.pattern as string;
    return undefined;
};

// Create params object from rule type and value
const createRuleParams = (
    ruleType: TValidationRuleType,
    value?: number | string
): TValidationRule["params"] => {
    switch (ruleType) {
        case "required":
            return { type: "required" };
        case "minLength":
            return { type: "minLength", min: Number(value) || 0 };
        case "maxLength":
            return { type: "maxLength", max: Number(value) || 100 };
        case "pattern":
            return { type: "pattern", pattern: String(value) || "" };
        case "email":
            return { type: "email" };
        case "url":
            return { type: "url" };
        case "phone":
            return { type: "phone" };
        case "minValue":
            return { type: "minValue", min: Number(value) || 0 };
        case "maxValue":
            return { type: "maxValue", max: Number(value) || 100 };
        case "minSelections":
            return { type: "minSelections", min: Number(value) || 1 };
        case "maxSelections":
            return { type: "maxSelections", max: Number(value) || 3 };
        default:
            return { type: "required" };
    }
};

export const ValidationRulesEditor = ({
    elementType,
    validationRules,
    onUpdateRules,
}: ValidationRulesEditorProps) => {
    const { t } = useTranslation();

    const isEnabled = validationRules.length > 0;

    const handleEnable = () => {
        const availableRules = getAvailableRuleTypes(elementType, []);
        if (availableRules.length > 0) {
            const defaultRuleType = availableRules[0];
            const newRule: TValidationRule = {
                id: createId(),
                params: createRuleParams(defaultRuleType),
                enabled: true,
            };
            onUpdateRules([newRule]);
        }
    };

    const handleDisable = () => {
        onUpdateRules([]);
    };

    const handleToggle = (checked: boolean) => {
        if (checked) {
            handleEnable();
        } else {
            handleDisable();
        }
    };

    const handleAddRule = () => {
        const availableRules = getAvailableRuleTypes(elementType, validationRules);
        if (availableRules.length === 0) return;

        const newRuleType = availableRules[0];
        const newRule: TValidationRule = {
            id: createId(),
            params: createRuleParams(newRuleType),
            enabled: true,
        };
        onUpdateRules([...validationRules, newRule]);
    };

    const handleDeleteRule = (ruleId: string) => {
        const updated = validationRules.filter((r) => r.id !== ruleId);
        onUpdateRules(updated);
    };

    const handleRuleTypeChange = (ruleId: string, newType: TValidationRuleType) => {
        const updated = validationRules.map((rule) => {
            if (rule.id !== ruleId) return rule;
            return {
                ...rule,
                params: createRuleParams(newType),
            };
        });
        onUpdateRules(updated);
    };

    const handleRuleValueChange = (ruleId: string, value: string) => {
        const updated = validationRules.map((rule) => {
            if (rule.id !== ruleId) return rule;
            const ruleType = rule.params.type;
            const config = RULE_TYPE_CONFIG[ruleType];
            const parsedValue = config.valueType === "number" ? Number(value) || 0 : value;
            return {
                ...rule,
                params: createRuleParams(ruleType, parsedValue),
            };
        });
        onUpdateRules(updated);
    };

    const availableRulesForAdd = getAvailableRuleTypes(elementType, validationRules);
    const canAddMore = availableRulesForAdd.length > 0;

    return (
        <AdvancedOptionToggle
            isChecked={isEnabled}
            onToggle={handleToggle}
            htmlId="validation-rules-toggle"
            title={t("environments.surveys.edit.validation_rules")}
            description={t("environments.surveys.edit.validation_rules_description")}
            customContainerClass="p-0 mt-4"
            childrenContainerClass="flex-col p-3 gap-2">
            {validationRules.map((rule, index) => {
                const ruleType = rule.params.type;
                const config = RULE_TYPE_CONFIG[ruleType];
                const currentValue = getRuleValue(rule);

                // Get available types for this rule (current type + unused types, no duplicates)
                const otherAvailableTypes = getAvailableRuleTypes(
                    elementType,
                    validationRules.filter((r) => r.id !== rule.id)
                ).filter((t) => t !== ruleType);
                const availableTypesForSelect = [ruleType, ...otherAvailableTypes];

                return (
                    <div key={rule.id} className="flex w-full items-center gap-2">
                        {/* Rule Type Selector */}
                        <Select value={ruleType} onValueChange={(value) => handleRuleTypeChange(rule.id, value as TValidationRuleType)}>
                            <SelectTrigger className={config.needsValue ? "w-[160px]" : "flex-1"}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTypesForSelect.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {RULE_TYPE_CONFIG[type].label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Value Input (if needed) */}
                        {config.needsValue && (
                            <>
                                <Input
                                    type={config.valueType === "number" ? "number" : "text"}
                                    value={currentValue ?? ""}
                                    onChange={(e) => handleRuleValueChange(rule.id, e.target.value)}
                                    placeholder={config.valuePlaceholder}
                                    className="w-[80px] bg-white"
                                    min={config.valueType === "number" ? 0 : undefined}
                                />

                                {/* Unit selector (if applicable) */}
                                {config.unitOptions && config.unitOptions.length > 0 && (
                                    <Select value={config.unitOptions[0].value} disabled>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {config.unitOptions.map((unit) => (
                                                <SelectItem key={unit.value} value={unit.value}>
                                                    {unit.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </>
                        )}

                        {/* Delete button */}
                        <Button
                            variant="secondary"
                            size="icon"
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="shrink-0">
                            <TrashIcon className="h-4 w-4" />
                        </Button>

                        {/* Add button (only on last row and if can add more) */}
                        {index === validationRules.length - 1 && canAddMore && (
                            <Button
                                variant="secondary"
                                size="icon"
                                type="button"
                                onClick={handleAddRule}
                                className="shrink-0">
                                <PlusIcon className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                );
            })}
        </AdvancedOptionToggle>
    );
};

