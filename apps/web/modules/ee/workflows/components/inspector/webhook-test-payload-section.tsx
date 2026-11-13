"use client";

import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { JsonEditor } from "@/modules/ee/workflows/components/json-editor/json-editor";
import {
  clearStoredTestPayload,
  readStoredTestPayload,
  resolveTestPayload,
  writeStoredTestPayload,
} from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";

export const WebhookTestPayloadSection = ({
  workflowId,
  sample,
}: {
  readonly workflowId: string;
  readonly sample: Record<string, unknown> | null;
}) => {
  const { t } = useTranslation();
  // Read once when the panel opens (it only renders in the browser, after the workflow loaded); kept
  // in this browser per workflow (ED6). Storage may be unavailable, in which case edits last only
  // while the panel is open.
  const [stored, setStored] = useState<string | null>(() => readStoredTestPayload(workflowId));

  const { text, source } = resolveTestPayload({ stored, sample });

  const statusTexts: Record<typeof source, string> = {
    edited: t("workspace.workflows.test_payload_edited"),
    received: t("workspace.workflows.test_payload_from_sample"),
    empty: t("workspace.workflows.test_payload_empty"),
  };
  const statusText = statusTexts[source];

  return (
    <section className="flex flex-col gap-2">
      <Label htmlFor="workflow-webhook-test-payload">{t("workspace.workflows.test_payload")}</Label>
      <div className="ph-no-capture">
        <JsonEditor
          id="workflow-webhook-test-payload"
          label={t("workspace.workflows.test_payload")}
          value={text}
          // Blank until there is a sample or an edit; only a started payload must be valid JSON.
          allowEmpty
          onChange={(next) => {
            setStored(next);
            writeStoredTestPayload(workflowId, next);
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">{statusText}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={source !== "edited" || !sample}
          onClick={() => {
            clearStoredTestPayload(workflowId);
            setStored(null);
          }}>
          <RotateCcwIcon />
          {t("workspace.workflows.test_payload_reset")}
        </Button>
      </div>
      <Alert variant="info">
        <AlertDescription>{t("workspace.workflows.test_payload_hint")}</AlertDescription>
      </Alert>
    </section>
  );
};
