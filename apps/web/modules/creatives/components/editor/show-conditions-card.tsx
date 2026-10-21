"use client";

import { FilterIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TShowConditions } from "@formbricks/types/show-conditions";
import { ShowConditionsBlock } from "@/modules/show-conditions/components/show-conditions-block";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { EditorPanel } from "./editor-primitives";

/**
 * Show when: the shared show conditions block surveys use (ENG-3926), titled by this card. `children`
 * sits at the bottom of the card: creatives put Share of visitors there.
 */
export const ShowConditionsCard = ({
  value,
  onChange,
  showErrors,
  children,
}: Readonly<{
  value: TShowConditions;
  onChange: (value: TShowConditions) => void;
  showErrors: boolean;
  children?: React.ReactNode;
}>) => {
  const { t } = useTranslation();

  return (
    <EditorPanel
      title={t("workspace.creatives.conditions.title")}
      icon={FilterIcon}
      description={t("workspace.creatives.conditions.description")}>
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
