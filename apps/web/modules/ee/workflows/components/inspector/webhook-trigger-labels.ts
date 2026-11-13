import { useTranslation } from "react-i18next";
import { type TWebhookPayloadRefusal, WEBHOOK_PAYLOAD_MAX_BYTES } from "@formbricks/workflows";
import { formatCallerIp } from "@/modules/ee/workflows/lib/caller-ip";
import { formatRelativeDate } from "@/modules/ee/workflows/lib/format-date";
import { type TVariableTypeLabel } from "@/modules/ee/workflows/lib/webhook-trigger-panel";

export const useTypeLabel = () => {
  const { t } = useTranslation();
  return (label: TVariableTypeLabel): string => {
    switch (label) {
      case "text":
        return t("workspace.workflows.variable_type_text");
      case "number":
        return t("workspace.workflows.variable_type_number");
      case "true_false":
        return t("workspace.workflows.variable_type_boolean");
      case "object":
        return t("workspace.workflows.variable_type_object");
      case "empty":
        return t("workspace.workflows.variable_type_empty");
      case "list":
        return t("workspace.workflows.variable_type_list");
      case "unsupported":
        return t("workspace.workflows.variable_not_supported");
    }
  };
};

export const usePasteErrorMessage = () => {
  const { t } = useTranslation();
  return (reason: TWebhookPayloadRefusal): string => {
    switch (reason) {
      case "invalid_json":
        return t("workspace.workflows.webhook_paste_invalid_json");
      case "not_object":
        return t("workspace.workflows.webhook_paste_not_object");
      case "too_deep":
        return t("workspace.workflows.webhook_paste_too_deep");
      case "too_large":
        return t("workspace.workflows.webhook_paste_too_large", {
          size: WEBHOOK_PAYLOAD_MAX_BYTES / 1024,
        });
      case "null_byte":
        return t("workspace.workflows.webhook_paste_null_byte");
    }
  };
};

export const useRelativeTime = () => {
  const { t, i18n } = useTranslation();
  return (iso: string) =>
    formatRelativeDate(
      iso,
      new Date(),
      t,
      i18n.language || "en-US",
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
};

export const useCallerIpLabel = () => {
  const { t } = useTranslation();
  return (ip: string | null): string => {
    const display = formatCallerIp(ip);
    return display.kind === "unknown" ? t("workspace.workflows.run_caller_unknown") : display.text;
  };
};
