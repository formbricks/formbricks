"use client";

import { FilterIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TShowConditions } from "@formbricks/types/show-conditions";
import { ShowConditionsBlock } from "@/modules/show-conditions/components/show-conditions-block";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { countShowConditions } from "../../lib/panel-summaries";
import { EditorPanel } from "./editor-primitives";
import { ShowWhenSummary } from "./panel-summaries";

/**
 * Show when: the shared show conditions block surveys use (ENG-3926), titled by this card. `children`
 * sits at the bottom of the card: creatives put Share of visitors there, whose `displayPercentage` the
 * folded card's summary reads.
 */
export const ShowConditionsCard = ({
  value,
  onChange,
  showErrors,
  displayPercentage,
  children,
}: Readonly<{
  value: TShowConditions;
  onChange: (value: TShowConditions) => void;
  showErrors: boolean;
  displayPercentage: number | null;
  children?: React.ReactNode;
}>) => {
  const { t } = useTranslation();

  return (
    <EditorPanel
      title={t("workspace.creatives.conditions.title")}
      icon={FilterIcon}
      description={t("workspace.creatives.conditions.description")}
      fold={{
        id: "showWhen",
        summary: (
          <ShowWhenSummary
            conditionCount={countShowConditions(value)}
            displayPercentage={displayPercentage}
          />
        ),
        attention: showErrors ? "error" : undefined,
      }}>
      {showErrors && (
        <Alert variant="error" size="small">
          <AlertDescription>{t("workspace.creatives.editor.issue_condition_incomplete")}</AlertDescription>
        </Alert>
      )}
      {/* Creatives only show on websites, so the surveys' note about mobile apps doesn't apply. */}
      <ShowConditionsBlock value={value} onChange={onChange} showHeading={false} showMobileNote={false} />
      {children}
    </EditorPanel>
  );
};
