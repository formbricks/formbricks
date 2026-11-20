"use client";

import { RotateCcwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { JsonEditor } from "@/modules/ee/workflows/components/json-editor/json-editor";
import type { TTestPayloadSource } from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface TestRunPayloadEditorProps {
  text: string;
  source: TTestPayloadSource;
  canReset: boolean;
  onChange: (text: string) => void;
  onReset: () => void;
  /** "Run test", on the reset's row, at its far end. */
  runButton: ReactNode;
}

/**
 * The Runs view's test payload, editable (ED6): the same test payload the Webhook trigger panel edits,
 * kept in this browser, which "Run test" sends. Under it, where it comes from on its own line, then
 * "Reset to last received" and "Run test" at either end of one row.
 */
export const TestRunPayloadEditor = ({
  text,
  source,
  canReset,
  onChange,
  onReset,
  runButton,
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
      <p className="text-xs text-slate-500">{statusTexts[source]}</p>
      <div className="flex items-center justify-between gap-3">
        {/* Short so it shares a row with "Run test"; the tooltip says what it resets to. The span
            trigger keeps the tooltip working while the button is disabled. */}
        <TooltipRenderer
          tooltipContent={t("workspace.workflows.test_payload_reset_hint")}
          triggerClass="-ml-2 inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-600"
            disabled={!canReset}
            onClick={onReset}>
            <RotateCcwIcon />
            {t("workspace.workflows.test_payload_reset")}
          </Button>
        </TooltipRenderer>
        {runButton}
      </div>
    </div>
  );
};
