"use client";

import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TShowConditions } from "@formbricks/types/show-conditions";
import {
  getShowConditionOperandLabel,
  getShowConditionOperatorLabel,
} from "@/modules/show-conditions/lib/options";
import {
  listUrlTestableConditions,
  testUrlAgainstShowConditions,
} from "@/modules/show-conditions/lib/url-tester";
import { summarizeConditionValue } from "@/modules/show-conditions/lib/value-input";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

interface ShowConditionsUrlTesterProps {
  conditions: TShowConditions;
}

export const ShowConditionsUrlTester = ({ conditions }: Readonly<ShowConditionsUrlTesterProps>) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  // The URL that was tested, not its result: the result is worked out on every render, so editing a
  // condition after a test updates it instead of leaving an answer for the old conditions.
  const [testedUrl, setTestedUrl] = useState<string | null>(null);

  if (listUrlTestableConditions(conditions).length === 0) return null;

  const results = testedUrl === null ? null : testUrlAgainstShowConditions(conditions, testedUrl);
  const runTest = () => {
    if (url.trim() === "") return;
    setTestedUrl(url);
  };
  const allPassed = results?.every((result) => result.passed) ?? false;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-slate-800">{t("workspace.actions.test_your_url")}</p>
        <p className="text-sm text-slate-500">
          {t("workspace.surveys.edit.show_conditions.tester_description")}
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          type="url"
          className="bg-white"
          value={url}
          placeholder={t("workspace.surveys.edit.show_conditions.tester_placeholder")}
          aria-label={t("workspace.actions.test_your_url")}
          isInvalid={results !== null && !allPassed}
          onChange={(event) => {
            setUrl(event.target.value);
            setTestedUrl(null);
          }}
          onKeyDown={(event) => {
            // Enter also confirms an IME candidate; testing then would run on a half-typed URL.
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            runTest();
          }}
        />
        <Button type="button" variant="secondary" disabled={url.trim() === ""} onClick={runTest}>
          {t("workspace.actions.test_match")}
        </Button>
      </div>
      {results && (
        <div className="flex flex-col gap-1" aria-live="polite">
          <p className="text-sm font-medium text-slate-800">
            {allPassed
              ? t("workspace.surveys.edit.show_conditions.tester_all_match")
              : t("workspace.surveys.edit.show_conditions.tester_not_all_match")}
          </p>
          <ul className="flex flex-col gap-1">
            {results.map(({ condition, passed }) => (
              <li key={condition.id} className="flex items-start gap-2 text-sm text-slate-700">
                {passed ? (
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                ) : (
                  <XCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
                )}
                <span>
                  <span className="sr-only">
                    {passed
                      ? t("workspace.surveys.edit.show_conditions.tester_matches")
                      : t("workspace.surveys.edit.show_conditions.tester_does_not_match")}
                  </span>
                  {getShowConditionOperandLabel(condition.leftOperand.value, t)}
                  {condition.leftOperand.meta?.key ? ` "${condition.leftOperand.meta.key}"` : ""}{" "}
                  {getShowConditionOperatorLabel(condition.operator, t)} {summarizeConditionValue(condition)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
