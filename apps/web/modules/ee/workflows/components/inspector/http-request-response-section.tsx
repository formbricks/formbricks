"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  type TWorkflowHttpRequestActionConfig,
  type TWorkflowHttpRequestActionNode,
} from "@formbricks/workflows";
import { getTypeHintLabel } from "@/modules/ee/workflows/components/variable-picker/workflow-variable-picker";
import { useWorkflowSamples } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { getStepOutputOptionsFromSample } from "@/modules/ee/workflows/lib/variable-picker";
import { toStepVariableContext } from "@/modules/ee/workflows/lib/workflow-samples";
import { Label } from "@/modules/ui/components/label";
import { TabToggle } from "@/modules/ui/components/tab-toggle";

export const HttpResponseSection = ({
  node,
  isEditable,
  canReadSamples,
  workflowId,
  onModeChange,
}: {
  readonly node: TWorkflowHttpRequestActionNode;
  readonly isEditable: boolean;
  readonly canReadSamples: boolean;
  readonly workflowId: string;
  readonly onModeChange: (mode: TWorkflowHttpRequestActionConfig["responseMode"]) => void;
}) => {
  const { t } = useTranslation();
  const samples = useWorkflowSamples({ workflowId, enabled: canReadSamples });
  const sample = toStepVariableContext(samples.data).stepSamples[node.id];
  const options = useMemo(
    () =>
      sample ? getStepOutputOptionsFromSample(node.id, { status: sample.status, body: sample.body }) : [],
    [node.id, sample]
  );
  const isWaiting = node.config.responseMode === "wait";

  return (
    <section className="flex flex-col gap-2">
      <Label>{t("workspace.workflows.http_request_response")}</Label>
      <TabToggle
        id={`workflow-http-response-${node.id}`}
        value={node.config.responseMode}
        disabled={!isEditable}
        options={[
          { value: "dont_wait", label: t("workspace.workflows.http_request_dont_wait") },
          { value: "wait", label: t("workspace.workflows.http_request_wait") },
        ]}
        onChange={onModeChange}
      />
      <p className="text-xs text-slate-500">
        {isWaiting
          ? t("workspace.workflows.http_request_wait_help")
          : t("workspace.workflows.http_request_dont_wait_help")}
      </p>
      {isWaiting && options.length > 0 ? (
        <>
          <ul className="flex flex-col divide-y divide-slate-100 rounded-md border border-slate-200">
            {options.map((option) => (
              <li
                key={option.path}
                className={
                  option.isPickable
                    ? "flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-800"
                    : "flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-400"
                }>
                <span className="truncate font-mono">{option.label}</span>
                <span className="shrink-0 text-slate-500">{getTypeHintLabel(option.typeHint, t)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">{t("workspace.workflows.http_request_variables_help")}</p>
        </>
      ) : null}
      {isWaiting && options.length === 0 ? (
        <p className="text-xs text-slate-500">{t("workspace.workflows.http_request_variables_empty")}</p>
      ) : null}
    </section>
  );
};
