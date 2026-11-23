"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { useReplaceSecretHeader } from "@/modules/ee/workflows/hooks/use-send-test-request";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

/**
 * Replace on an enabled workflow: the panel is read-only, so the new value is saved on its own and
 * the enabled workflow uses it from its next run. The author is told so before saving.
 */
export const LiveSecretReplace = ({
  workflowId,
  stepId,
  headerName,
  onDone,
}: {
  readonly workflowId: string;
  readonly stepId: string;
  readonly headerName: string;
  readonly onDone: () => void;
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const replace = useReplaceSecretHeader({ workflowId, stepId });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-2">
      <Input
        type="password"
        autoComplete="off"
        value={value}
        placeholder={t("workspace.workflows.http_request_secret_placeholder")}
        aria-label={t("workspace.workflows.http_request_header_value")}
        className="ph-no-capture"
        onChange={(event) => setValue(event.target.value)}
      />
      <Alert variant="warning">
        <AlertDescription>{t("workspace.workflows.http_request_secret_live_warning")}</AlertDescription>
      </Alert>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={value === "" || replace.isPending}
          loading={replace.isPending}
          onClick={() =>
            replace.mutate(
              { headerName, value },
              {
                onSuccess: () => {
                  toast.success(t("workspace.workflows.http_request_secret_replaced"));
                  onDone();
                },
                onError: (error) =>
                  toast.error(
                    getV3ApiErrorMessage(error, t("workspace.workflows.http_request_secret_replace_failed"))
                  ),
              }
            )
          }>
          {t("workspace.workflows.http_request_replace")}
        </Button>
      </div>
    </div>
  );
};
