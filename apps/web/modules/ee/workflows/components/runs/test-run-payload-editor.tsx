"use client";

import { RotateCcwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { JsonEditor } from "@/modules/ee/workflows/components/json-editor/json-editor";
import type { TTestPayloadSource } from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Button } from "@/modules/ui/components/button";

interface TestRunPayloadEditorProps {
  text: string;
  source: TTestPayloadSource;
  canReset: boolean;
  onChange: (text: string) => void;
  onReset: () => void;
}

/**
 * The Test run drawer's Webhook step payload, editable (ED6): the same test payload the Webhook
 * trigger panel edits, kept in this browser, which Run again sends. Real runs show theirs read-only.
 */
export const TestRunPayloadEditor = ({
  text,
  source,
  canReset,
  onChange,
  onReset,
}: Readonly<TestRunPayloadEditorProps>) => {
  const { t } = useTranslation();
  const statusTexts: Record<TTestPayloadSource, string> = {
    edited: t("workspace.workflows.test_payload_edited"),
    received: t("workspace.workflows.test_payload_from_sample"),
    empty: t("workspace.workflows.test_payload_empty"),
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="ph-no-capture">
        <JsonEditor
          id="workflow-test-run-payload"
          label={t("workspace.workflows.test_payload")}
          value={text}
          // Blank sends no payload, and the server tests with the Sample payload.
          allowEmpty
          onChange={onChange}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">{statusTexts[source]}</span>
        <Button type="button" variant="ghost" size="sm" disabled={!canReset} onClick={onReset}>
          <RotateCcwIcon />
          {t("workspace.workflows.test_payload_reset")}
        </Button>
      </div>
    </div>
  );
};
