"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkflowVariableInput } from "@/modules/ee/workflows/components/inspector/workflow-variable-input";
import {
  canInsertUrlVariableAt,
  getUrlVariableIssue,
  isPlainHttpUrl,
} from "@/modules/ee/workflows/lib/http-request-panel";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import type { TEditorRecallSource } from "@/modules/ui/components/editor/components/recall-source";
import { Label } from "@/modules/ui/components/label";

interface HttpRequestUrlSectionProps {
  nodeId: string;
  url: string;
  isEditable: boolean;
  /** The step's Variable picker; here `@` opens it only in the URL's path (ADR 0053). */
  recallSource: TEditorRecallSource;
  /** The method select, shown before the URL. */
  methodControl: ReactNode;
  onUrlChange: (url: string) => void;
}

/**
 * The Request section of the HTTP request panel: method and URL. The URL's path takes Variables, its
 * scheme, host and port never do (ADR 0053): `@` typed before the path leaves the picker closed and
 * says where Variables go, and a Variable already outside the path (pasted, or set through the API)
 * shows the reason saving refuses it.
 */
export const HttpRequestUrlSection = ({
  nodeId,
  url,
  isEditable,
  recallSource,
  methodControl,
  onUrlChange,
}: Readonly<HttpRequestUrlSectionProps>) => {
  const { t } = useTranslation();
  const [isPickerRefused, setIsPickerRefused] = useState(false);
  const urlRecallSource = useMemo<TEditorRecallSource>(
    () => ({
      ...recallSource,
      canInsertAt: (textBefore) => {
        const allowed = canInsertUrlVariableAt(textBefore);
        setIsPickerRefused(!allowed);
        return allowed;
      },
    }),
    [recallSource]
  );
  const issue = getUrlVariableIssue(url);
  const issueMessages = {
    variable_before_path: t("workspace.workflows.http_request_url_issue_variable_before_path"),
    variable_after_path: t("workspace.workflows.http_request_url_issue_variable_after_path"),
    not_a_variable: t("workspace.workflows.http_request_url_issue_not_a_variable"),
  };

  let note: ReactNode = (
    <p className="text-xs text-slate-500">{t("workspace.workflows.http_request_url_help")}</p>
  );
  if (issue) {
    note = <p className="text-sm text-error">{issueMessages[issue]}</p>;
  } else if (isPickerRefused) {
    note = (
      <p className="text-sm text-amber-700">{t("workspace.workflows.http_request_url_variables_in_path")}</p>
    );
  }

  return (
    // The Request card around it shows the visible title; the label stays for the URL field's name.
    <div className="flex flex-col gap-2">
      <Label htmlFor={`workflow-http-url-${nodeId}`} className="sr-only">
        {t("workspace.workflows.http_request_request")}
      </Label>
      <div className="flex gap-2">
        {methodControl}
        <WorkflowVariableInput
          id={`workflow-http-url-${nodeId}`}
          value={url}
          disabled={!isEditable}
          placeholder="https://api.example.com/customers"
          aria-label={t("workspace.workflows.http_request_url")}
          className="min-w-0 flex-1"
          isInvalid={issue !== null}
          recallSource={urlRecallSource}
          onChange={(next) => {
            if (!next.endsWith("@")) setIsPickerRefused(false);
            onUrlChange(next);
          }}
        />
      </div>
      {note}
      {isPlainHttpUrl(url) ? (
        <Alert variant="warning">
          <AlertDescription>{t("workspace.workflows.http_request_plain_http_warning")}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};
