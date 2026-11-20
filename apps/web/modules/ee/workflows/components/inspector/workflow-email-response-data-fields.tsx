"use client";

import { useTranslation } from "react-i18next";
import { type TWorkflowSendEmailActionNode, getIncludeEmbeddedData } from "@formbricks/workflows";
import { InspectorCard } from "@/modules/ee/workflows/components/inspector/inspector-card";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

export const WorkflowEmailResponseDataFields = ({
  node,
  isEditable,
  updateConfig,
}: Readonly<{
  node: TWorkflowSendEmailActionNode;
  isEditable: boolean;
  updateConfig: (next: Partial<TWorkflowSendEmailActionNode["config"]>) => void;
}>) => {
  const { t } = useTranslation();
  // One card: the switch in its header turns response data on; the options for it follow inside,
  // instead of a second bordered box under the first.
  return (
    <InspectorCard
      title={
        <Label htmlFor="workflow-email-attach-response-data" className="text-sm font-medium">
          {t("workspace.workflows.email_attach_response_data_label")}
        </Label>
      }
      description={t("workspace.workflows.email_attach_response_data_description")}
      aside={
        <Switch
          id="workflow-email-attach-response-data"
          checked={node.config.attachResponseData}
          disabled={!isEditable}
          onCheckedChange={(checked) => updateConfig({ attachResponseData: checked })}
        />
      }>
      {node.config.attachResponseData ? (
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <Label htmlFor="workflow-email-include-variables" className="text-sm font-medium">
                {t("workspace.workflows.email_include_variables_label")}
              </Label>
              <p className="text-xs text-slate-500">
                {t("workspace.workflows.email_include_embedded_data_description")}
              </p>
            </div>
            {/* One switch for all Embedded Data: the passed-in fields (Follow-ups' "hidden fields") and
                the computed ones are both Embedded Data now. It sets both settings the step keeps for
                Follow-ups parity; the deprecated name is dropped so the two never mix (ADR 0050). */}
            <Switch
              id="workflow-email-include-variables"
              checked={getIncludeEmbeddedData(node.config) || (node.config.includeHiddenFields ?? false)}
              disabled={!isEditable}
              onCheckedChange={(checked) =>
                updateConfig({
                  includeEmbeddedData: checked,
                  includeHiddenFields: checked,
                  includeVariables: undefined,
                })
              }
            />
          </div>
        </div>
      ) : null}
    </InspectorCard>
  );
};
