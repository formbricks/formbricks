"use client";

import { SendIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type TWorkflowHttpRequestActionNode, type TWorkflowTestRequestResult } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { useSendTestRequest } from "@/modules/ee/workflows/hooks/use-send-test-request";
import { buildTestRequestInput, formatResponseBody } from "@/modules/ee/workflows/lib/http-request-panel";
import { readStoredTestPayload } from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";

export const SendTestRequestSection = ({
  node,
  workflowId,
}: {
  readonly node: TWorkflowHttpRequestActionNode;
  readonly workflowId: string;
}) => {
  const { t } = useTranslation();
  const sendTestRequest = useSendTestRequest({ workflowId, stepId: node.id });
  const [result, setResult] = useState<TWorkflowTestRequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    sendTestRequest.mutate(buildTestRequestInput(node.config, readStoredTestPayload(workflowId)), {
      onSuccess: setResult,
      onError: (cause) => {
        setResult(null);
        setError(getV3ApiErrorMessage(cause, t("workspace.workflows.http_request_test_failed")));
      },
    });
  };

  const response = result?.response ?? null;
  const responseText = response === null ? null : formatResponseBody(response.body);

  return (
    <section className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        className="w-fit"
        loading={sendTestRequest.isPending}
        disabled={sendTestRequest.isPending}
        onClick={send}>
        <SendIcon />
        {t("workspace.workflows.http_request_send_test")}
      </Button>
      <p className="text-xs text-slate-500">{t("workspace.workflows.http_request_send_test_help")}</p>
      {error ? (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {result && !response ? (
        <Alert variant="error">
          <AlertDescription>
            {result.error ?? t("workspace.workflows.http_request_test_no_answer")}
          </AlertDescription>
        </Alert>
      ) : null}
      {response ? (
        <div className="ph-no-capture flex flex-col gap-1">
          <p className="text-xs font-medium text-slate-700">
            {t("workspace.workflows.http_request_test_response", { status: response.status })}
          </p>
          <div className="max-h-64 overflow-auto">
            <CodeBlock
              language={typeof response.body === "string" ? "text" : "json"}
              noMargin
              showCopyToClipboard>
              {responseText ?? ""}
            </CodeBlock>
          </div>
          {response.bodyTruncated ? (
            <p className="text-xs text-slate-500">{t("workspace.workflows.http_request_test_truncated")}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
