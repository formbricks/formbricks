"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { createApiKeyAction } from "@/modules/organization/settings/api-keys/actions";
import { AgentConnectTabs } from "@/modules/shell/connect/components/agent-connect-tabs";
import { Alert, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import {
  API_KEY_PRESETS,
  type TApiKeyFormValues,
  type TApiKeyPreset,
  buildApiKeyCreateInput,
  canSubmitApiKey,
} from "../lib/api-key-presets";

interface CreateConnectionButtonProps {
  organizationId: string;
  workspaces: { id: string; name: string }[];
  serverUrl: string;
  /** Opens the dialog on first render, for the "Create an API key" link on Connect your agent. */
  initialOpen?: boolean;
}

interface CreatedKey {
  secret: string;
  values: TApiKeyFormValues;
  workspaceNames: string[];
}

const INITIAL_VALUES: TApiKeyFormValues = {
  label: "",
  preset: "read",
  workspaceIds: [],
  allowAuditRead: false,
};

// Spelled out rather than looked up by preset id: `scan-translations` does not follow built keys.
const usePresetCopy = () => {
  const { t } = useTranslation();
  const copy: Record<TApiKeyPreset, { title: string; description: string }> = {
    read: {
      title: t("shell.connections.create.preset_read_title"),
      description: t("shell.connections.create.preset_read_description"),
    },
    author: {
      title: t("shell.connections.create.preset_author_title"),
      description: t("shell.connections.create.preset_author_description"),
    },
    full: {
      title: t("shell.connections.create.preset_full_title"),
      description: t("shell.connections.create.preset_full_description"),
    },
  };
  return copy;
};

const CreatedSummary = ({ created }: Readonly<{ created: CreatedKey }>) => {
  const { t } = useTranslation();
  const presetCopy = usePresetCopy();
  const { values, workspaceNames } = created;

  const rows = [
    [t("common.name"), values.label.trim()],
    [
      t("shell.connections.columns.access"),
      values.allowAuditRead
        ? `${presetCopy[values.preset].title} · ${t("shell.connections.create.audit_summary")}`
        : presetCopy[values.preset].title,
    ],
    [
      t("common.workspaces"),
      workspaceNames.length > 0 ? workspaceNames.join(", ") : t("shell.connections.workspaces.none"),
    ],
  ];

  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-[110px_minmax(0,1fr)]">
      {rows.map(([term, description]) => (
        <div key={term} className="contents">
          <dt className="text-slate-500">{term}</dt>
          <dd className="mb-2 font-medium break-words text-slate-800 sm:mb-0">{description}</dd>
        </div>
      ))}
    </dl>
  );
};

const CreatedStep = ({ created, serverUrl }: Readonly<{ created: CreatedKey; serverUrl: string }>) => {
  const { t } = useTranslation();

  const handleCopy = async () => {
    if (await copyToClipboard(created.secret)) {
      toast.success(t("common.copied_to_clipboard"));
    } else {
      toast.error(t("common.failed_to_copy_to_clipboard"));
    }
  };

  return (
    <div className="flex flex-col gap-4 px-1 py-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="created-api-key">{t("workspace.api_keys.api_key")}</Label>
        <div className="flex gap-2">
          <Input
            id="created-api-key"
            readOnly
            value={created.secret}
            className="font-mono"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button type="button" variant="outline" onClick={handleCopy}>
            {t("common.copy")}
          </Button>
        </div>
      </div>

      <Alert variant="warning" role="status">
        <AlertTitle>{t("shell.connections.created.warning")}</AlertTitle>
      </Alert>

      <CreatedSummary created={created} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">{t("shell.connections.created.use_title")}</span>
        <AgentConnectTabs serverUrl={serverUrl} mode="apiKey" />
        <p className="text-sm text-slate-500">{t("shell.connections.created.header_hint")}</p>
      </div>
    </div>
  );
};

export const CreateConnectionButton = ({
  organizationId,
  workspaces,
  serverUrl,
  initialOpen = false,
}: Readonly<CreateConnectionButtonProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const presetCopy = usePresetCopy();
  const [open, setOpen] = useState(initialOpen);
  const [values, setValues] = useState<TApiKeyFormValues>(INITIAL_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedKey | null>(null);

  const close = () => {
    setOpen(false);
    setCreated(null);
    setValues(INITIAL_VALUES);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setOpen(true);
    } else if (!isSubmitting) {
      close();
    }
  };

  const toggleWorkspace = (workspaceId: string, checked: boolean) => {
    setValues((current) => ({
      ...current,
      workspaceIds: checked
        ? [...current.workspaceIds, workspaceId]
        : current.workspaceIds.filter((id) => id !== workspaceId),
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmitApiKey(values) || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await createApiKeyAction({
        organizationId,
        apiKeyData: buildApiKeyCreateInput(values),
      });

      if (result?.data) {
        setCreated({
          secret: result.data.actualKey,
          values,
          workspaceNames: workspaces
            .filter(({ id }) => values.workspaceIds.includes(id))
            .map(({ name }) => name),
        });
        // The list behind the dialog is server-rendered; this adds the new key to it.
        router.refresh();
      } else {
        toast.error(
          (result && getFormattedErrorMessage(result)) || t("common.something_went_wrong_please_try_again")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {t("shell.connections.create_cta")}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent width="wide" disableCloseOnOutsideClick={created !== null} closeOnEscape>
          {created ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("shell.connections.created.title")}</DialogTitle>
                <DialogDescription>{t("shell.connections.created.description")}</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <CreatedStep created={created} serverUrl={serverUrl} />
              </DialogBody>
              <DialogFooter>
                <Button type="button" onClick={close}>
                  {t("common.done")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("shell.connections.create_cta")}</DialogTitle>
                <DialogDescription>{t("shell.connections.create.description")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="contents">
                <DialogBody className="flex flex-col gap-5 px-1 py-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="api-key-name">{t("common.name")}</Label>
                    <Input
                      id="api-key-name"
                      value={values.label}
                      placeholder={t("shell.connections.create.name_placeholder")}
                      autoComplete="off"
                      onChange={(event) => setValues({ ...values, label: event.target.value })}
                    />
                  </div>

                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-medium text-slate-800">
                      {t("common.workspaces")}
                    </legend>
                    {workspaces.length === 0 && (
                      <p className="text-slate-500">{t("shell.connections.create.workspaces_empty")}</p>
                    )}
                    {workspaces.map((workspace) => (
                      <div key={workspace.id} className="flex min-h-8 items-center gap-2.5">
                        <Checkbox
                          id={`api-key-workspace-${workspace.id}`}
                          checked={values.workspaceIds.includes(workspace.id)}
                          onCheckedChange={(checked) => toggleWorkspace(workspace.id, checked === true)}
                        />
                        <Label htmlFor={`api-key-workspace-${workspace.id}`} className="leading-5">
                          {workspace.name}
                        </Label>
                      </div>
                    ))}
                  </fieldset>

                  <div className="flex flex-col gap-2">
                    <span id="api-key-access-label" className="text-sm font-medium text-slate-800">
                      {t("shell.connections.columns.access")}
                    </span>
                    <RadioGroup
                      aria-labelledby="api-key-access-label"
                      value={values.preset}
                      onValueChange={(preset) => setValues({ ...values, preset: preset as TApiKeyPreset })}
                      className="gap-2">
                      {API_KEY_PRESETS.map((preset) => (
                        <div
                          key={preset}
                          className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 has-data-[state=checked]:border-slate-400 has-data-[state=checked]:bg-slate-50">
                          <RadioGroupItem
                            value={preset}
                            id={`api-key-preset-${preset}`}
                            aria-describedby={`api-key-preset-${preset}-description`}
                            className="mt-0.5"
                          />
                          <div className="flex flex-col gap-1">
                            <Label htmlFor={`api-key-preset-${preset}`} className="leading-5">
                              {presetCopy[preset].title}
                            </Label>
                            <p id={`api-key-preset-${preset}-description`} className="text-slate-500">
                              {presetCopy[preset].description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="api-key-audit-read"
                      className="mt-0.5"
                      checked={values.allowAuditRead}
                      onCheckedChange={(checked) =>
                        setValues({ ...values, allowAuditRead: checked === true })
                      }
                    />
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="api-key-audit-read" className="leading-5">
                        {t("shell.connections.create.audit_label")}
                      </Label>
                      <p className="text-slate-500">{t("shell.connections.create.audit_hint")}</p>
                    </div>
                  </div>

                  <Alert variant="warning" role="status">
                    <AlertTitle>{t("shell.connections.create.respondent_data_warning")}</AlertTitle>
                  </Alert>
                </DialogBody>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={!canSubmitApiKey(values)} loading={isSubmitting}>
                    {t("shell.connections.create_cta")}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
