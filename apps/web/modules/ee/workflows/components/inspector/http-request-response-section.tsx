"use client";

import { useTranslation } from "react-i18next";
import {
  type TWorkflowHttpRequestActionConfig,
  type TWorkflowHttpRequestActionNode,
} from "@formbricks/workflows";
import { HttpResponseFieldsCard } from "@/modules/ee/workflows/components/inspector/http-request-response-fields";
import { InspectorCard } from "@/modules/ee/workflows/components/inspector/inspector-card";
import { useWorkflowSamples } from "@/modules/ee/workflows/hooks/use-workflow-webhook";
import { getStepResponseSamples } from "@/modules/ee/workflows/lib/workflow-samples";
import { TabToggle } from "@/modules/ui/components/tab-toggle";

/**
 * Whether the run waits for the API's answer, and, when it does, the expected response body later steps use
 * (ADR 0054), in their own card below.
 */
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
  const { expected, lastTest } = getStepResponseSamples(samples.data, node.id);
  const isWaiting = node.config.responseMode === "wait";

  return (
    <>
      <InspectorCard title={t("workspace.workflows.http_request_response")}>
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
      </InspectorCard>
      {isWaiting && canReadSamples ? (
        <HttpResponseFieldsCard
          stepId={node.id}
          workflowId={workflowId}
          expected={expected}
          lastTest={lastTest}
          isEditable={isEditable}
        />
      ) : null}
    </>
  );
};
