"use client";

import { useAtomValue } from "jotai";
import { LockIcon, LockOpenIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type TWorkflowHttpHeader,
  type TWorkflowHttpRequestActionConfig,
  type TWorkflowHttpRequestActionNode,
  WORKFLOW_HTTP_METHODS,
  WORKFLOW_SECRET_MASK,
} from "@formbricks/workflows";
import { LiveSecretReplace } from "@/modules/ee/workflows/components/inspector/http-request-live-secret-replace";
import { HttpResponseSection } from "@/modules/ee/workflows/components/inspector/http-request-response-section";
import { SendTestRequestSection } from "@/modules/ee/workflows/components/inspector/http-request-send-test-section";
import { WorkflowStepNameField } from "@/modules/ee/workflows/components/inspector/workflow-step-name-field";
import { WorkflowVariableInput } from "@/modules/ee/workflows/components/inspector/workflow-variable-input";
import { JsonEditor } from "@/modules/ee/workflows/components/json-editor/json-editor";
import { useWorkflowVariablePicker } from "@/modules/ee/workflows/components/variable-picker/use-workflow-variable-picker";
import {
  cancelReplacingSecret,
  createHeaderRow,
  findDuplicateHeaderIndexes,
  getHeaderRowKind,
  getSavedSecretHeaderNames,
  getSecretReplaceMode,
  isPlainHttpUrl,
  methodSendsBody,
  renameHeader,
  shouldWarnSecretGoesLive,
  startReplacingSecret,
  toStoredBody,
  toggleHeaderLock,
  urlHasVariables,
} from "@/modules/ee/workflows/lib/http-request-panel";
import {
  isWorkflowReadOnlyAtom,
  workflowAtom,
  workflowStatusAtom,
} from "@/modules/ee/workflows/state/editor";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";

interface WorkflowHttpRequestFormProps {
  node: TWorkflowHttpRequestActionNode;
  isEditable: boolean;
  onChange: (next: TWorkflowHttpRequestActionNode) => void;
}

/**
 * The HTTP request panel (ED4, mock screen 5): method and a fixed URL (no Variables, ADR 0042), query
 * parameters and headers whose values take Variables, secret headers (locked, masked, Replace), the
 * JSON body, the response mode, Continue on error, and Send test request — the one real call an author
 * can make from the editor.
 */
export const WorkflowHttpRequestForm = ({
  node,
  isEditable,
  onChange,
}: Readonly<WorkflowHttpRequestFormProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const status = useAtomValue(workflowStatusAtom);
  const isReadOnly = useAtomValue(isWorkflowReadOnlyAtom);
  const picker = useWorkflowVariablePicker({ nodeId: node.id });
  const config = node.config;
  const workflowId = workflow?.id ?? "";
  // Header rows whose lock the author set by hand: the lock then stops following the name.
  const [lockChosenRows, setLockChosenRows] = useState<ReadonlySet<number>>(new Set());

  const updateConfig = (next: Partial<TWorkflowHttpRequestActionConfig>) =>
    onChange({ ...node, config: { ...config, ...next } });

  const setHeader = (index: number, header: TWorkflowHttpHeader) =>
    updateConfig({ headers: config.headers.map((current, i) => (i === index ? header : current)) });

  const duplicateHeaders = findDuplicateHeaderIndexes(config.headers);
  // Secrets the saved step holds a value for: typing over one of them is a Replace.
  const savedSecretNames = getSavedSecretHeaderNames(workflow?.definition ?? null, node.id);
  const isReplacingSecret = config.headers.some(
    (header) => getHeaderRowKind(header) === "secret_value" && savedSecretNames.has(header.name.toLowerCase())
  );
  const sendsBody = methodSendsBody(config.method);
  const replaceMode = getSecretReplaceMode({ status, isEditable, isReadOnly });
  // The stored secret being replaced on an enabled workflow, saved on its own (ADR 0043).
  const [liveReplaceIndex, setLiveReplaceIndex] = useState<number | null>(null);

  // The value cell of a header row: Variables for a plain value, the masked stored secret with
  // Replace, or a password field for a secret being typed.
  const renderHeaderValue = (
    header: TWorkflowHttpHeader,
    index: number,
    kind: ReturnType<typeof getHeaderRowKind>
  ) => {
    if (kind === "plain") {
      return (
        <WorkflowVariableInput
          value={header.value ?? ""}
          disabled={!isEditable}
          placeholder={t("workspace.workflows.http_request_value_placeholder")}
          aria-label={t("workspace.workflows.http_request_header_value")}
          className="min-w-0 flex-1"
          requestVariable={picker.requestVariable}
          onChange={(value) => setHeader(index, { ...header, value })}
        />
      );
    }
    if (kind === "secret_set") {
      return (
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-0.5 pr-0.5 pl-2">
          <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
            {t("workspace.workflows.http_request_secret_set", { mask: WORKFLOW_SECRET_MASK })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            disabled={replaceMode === null}
            onClick={() =>
              replaceMode === "inline"
                ? setHeader(index, startReplacingSecret(header))
                : setLiveReplaceIndex(index)
            }>
            {t("workspace.workflows.http_request_replace")}
          </Button>
        </div>
      );
    }
    return (
      // A secret value is typed once and never shown again; kept out of session recordings.
      <Input
        type="password"
        autoComplete="off"
        value={header.value ?? ""}
        disabled={!isEditable}
        placeholder={t("workspace.workflows.http_request_secret_placeholder")}
        aria-label={t("workspace.workflows.http_request_header_value")}
        className="ph-no-capture min-w-0 flex-1"
        onChange={(event) => setHeader(index, { name: header.name, secret: true, value: event.target.value })}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <WorkflowStepNameField node={node} isEditable={isEditable} onChange={onChange} />

      {/* Request */}
      <section className="flex flex-col gap-2">
        <Label htmlFor={`workflow-http-url-${node.id}`}>
          {t("workspace.workflows.http_request_request")}
        </Label>
        <div className="flex gap-2">
          <Select
            value={config.method}
            disabled={!isEditable}
            onValueChange={(method) =>
              updateConfig({ method: method as TWorkflowHttpRequestActionConfig["method"] })
            }>
            <SelectTrigger
              className="w-28 shrink-0 bg-white"
              aria-label={t("workspace.workflows.http_request_method")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKFLOW_HTTP_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id={`workflow-http-url-${node.id}`}
            value={config.url}
            disabled={!isEditable}
            placeholder="https://api.example.com/customers"
            isInvalid={urlHasVariables(config.url)}
            onChange={(event) => updateConfig({ url: event.target.value })}
          />
        </div>
        <p className="text-xs text-slate-500">{t("workspace.workflows.http_request_url_help")}</p>
        {urlHasVariables(config.url) ? (
          <p className="text-sm text-error">{t("workspace.workflows.http_request_url_no_variables")}</p>
        ) : null}
        {isPlainHttpUrl(config.url) ? (
          <Alert variant="warning">
            <AlertDescription>{t("workspace.workflows.http_request_plain_http_warning")}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      {/* Query parameters */}
      <section className="flex flex-col gap-2">
        <Label>{t("workspace.workflows.http_request_query_parameters")}</Label>
        {config.queryParameters.map((parameter, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={parameter.name}
              disabled={!isEditable}
              placeholder={t("common.name")}
              aria-label={t("workspace.workflows.http_request_query_name")}
              className="w-2/5"
              onChange={(event) =>
                updateConfig({
                  queryParameters: config.queryParameters.map((current, i) =>
                    i === index ? { ...current, name: event.target.value } : current
                  ),
                })
              }
            />
            <WorkflowVariableInput
              value={parameter.value}
              disabled={!isEditable}
              placeholder={t("workspace.workflows.http_request_value_placeholder")}
              aria-label={t("workspace.workflows.http_request_query_value")}
              className="min-w-0 flex-1"
              requestVariable={picker.requestVariable}
              onChange={(value) =>
                updateConfig({
                  queryParameters: config.queryParameters.map((current, i) =>
                    i === index ? { ...current, value } : current
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!isEditable}
              aria-label={t("workspace.workflows.http_request_remove_row")}
              onClick={() =>
                updateConfig({ queryParameters: config.queryParameters.filter((_, i) => i !== index) })
              }>
              <Trash2Icon />
            </Button>
          </div>
        ))}
        {isEditable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={() =>
              updateConfig({ queryParameters: [...config.queryParameters, { name: "", value: "" }] })
            }>
            <PlusIcon />
            {t("workspace.workflows.http_request_add_query_parameter")}
          </Button>
        ) : null}
        <p className="text-xs text-slate-500">{t("workspace.workflows.http_request_query_help")}</p>
      </section>

      {/* Headers */}
      <section className="flex flex-col gap-2">
        <Label>{t("workspace.workflows.http_request_headers")}</Label>
        {config.headers.map((header, index) => {
          const kind = getHeaderRowKind(header);
          const isLocked = header.secret === true;
          return (
            <div key={index} className="flex flex-col gap-1">
              {/* Four controls share the 360px inspector: a narrower name and smaller icon buttons
                  leave the value cell room for a stored secret's mask and its Replace button. */}
              <div className="flex items-center gap-1.5">
                <Input
                  value={header.name}
                  disabled={!isEditable}
                  placeholder={t("workspace.workflows.http_request_header_placeholder")}
                  aria-label={t("workspace.workflows.http_request_header_name")}
                  className="w-[30%] shrink-0"
                  isInvalid={duplicateHeaders.has(index)}
                  onChange={(event) =>
                    setHeader(index, renameHeader(header, event.target.value, lockChosenRows.has(index)))
                  }
                />
                {renderHeaderValue(header, index, kind)}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={!isEditable}
                  aria-pressed={isLocked}
                  aria-label={
                    isLocked
                      ? t("workspace.workflows.http_request_unlock_header")
                      : t("workspace.workflows.http_request_lock_header")
                  }
                  onClick={() => {
                    setLockChosenRows((current) => new Set(current).add(index));
                    setHeader(index, toggleHeaderLock(header));
                  }}>
                  {isLocked ? <LockIcon /> : <LockOpenIcon />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={!isEditable}
                  aria-label={t("workspace.workflows.http_request_remove_row")}
                  onClick={() => {
                    setLockChosenRows(new Set());
                    updateConfig({ headers: config.headers.filter((_, i) => i !== index) });
                  }}>
                  <Trash2Icon />
                </Button>
              </div>
              {kind === "secret_value" && savedSecretNames.has(header.name.toLowerCase()) && isEditable ? (
                <button
                  type="button"
                  className="w-fit text-xs text-slate-500 underline"
                  onClick={() => setHeader(index, cancelReplacingSecret(header))}>
                  {t("workspace.workflows.http_request_keep_saved_value")}
                </button>
              ) : null}
              {liveReplaceIndex === index && workflowId ? (
                <LiveSecretReplace
                  workflowId={workflowId}
                  stepId={node.id}
                  headerName={header.name}
                  onDone={() => setLiveReplaceIndex(null)}
                />
              ) : null}
              {kind === "secret_missing" || duplicateHeaders.has(index) ? (
                <p className="text-xs text-warning-foreground">
                  {duplicateHeaders.has(index)
                    ? t("workspace.workflows.http_request_header_duplicate")
                    : t("workspace.workflows.http_request_secret_missing")}
                </p>
              ) : null}
            </div>
          );
        })}
        {isEditable ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={() => updateConfig({ headers: [...config.headers, createHeaderRow()] })}>
            <PlusIcon />
            {t("workspace.workflows.http_request_add_header")}
          </Button>
        ) : null}
        <p className="text-xs text-slate-500">{t("workspace.workflows.http_request_headers_help")}</p>
        {isReplacingSecret && shouldWarnSecretGoesLive(status) ? (
          <Alert variant="warning">
            <AlertDescription>{t("workspace.workflows.http_request_secret_live_warning")}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      {/* Body */}
      {sendsBody ? (
        <section className="flex flex-col gap-2">
          <Label htmlFor={`workflow-http-body-${node.id}`}>
            {t("workspace.workflows.http_request_body")}
          </Label>
          <JsonEditor
            id={`workflow-http-body-${node.id}`}
            label={t("workspace.workflows.http_request_body")}
            value={config.body ?? ""}
            onChange={isEditable ? (text) => updateConfig({ body: toStoredBody(text) }) : undefined}
            onRequestVariable={isEditable ? picker.requestVariable : undefined}
            placeholder='{ "customer_id": @ }'
          />
          <p className="text-xs text-slate-500">{t("workspace.workflows.http_request_body_help")}</p>
        </section>
      ) : null}

      <HttpResponseSection
        node={node}
        isEditable={isEditable}
        canReadSamples={!isReadOnly && workflowId !== ""}
        workflowId={workflowId}
        onModeChange={(responseMode) => updateConfig({ responseMode })}
      />

      {/* Continue on error */}
      <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3">
        <div className="flex flex-col">
          <Label htmlFor={`workflow-http-continue-${node.id}`} className="text-sm font-medium">
            {t("workspace.workflows.http_request_continue_on_error")}
          </Label>
          <p className="text-xs text-slate-500">
            {t("workspace.workflows.http_request_continue_on_error_help")}
          </p>
        </div>
        <Switch
          id={`workflow-http-continue-${node.id}`}
          checked={config.continueOnError}
          disabled={!isEditable}
          onCheckedChange={(continueOnError) => updateConfig({ continueOnError })}
        />
      </div>

      {!isReadOnly && workflowId ? <SendTestRequestSection node={node} workflowId={workflowId} /> : null}
      {picker.pickerElement}
    </div>
  );
};
