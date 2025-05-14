"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { toast } from "react-hot-toast";

interface DisplayBackupCodesProps {
  backupCodes: string[];
  setOpen: (open: boolean) => void;
}

export const DisplayBackupCodes = ({ backupCodes, setOpen }: DisplayBackupCodesProps) => {
  const { t } = useTranslate();
  const formatBackupCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5, 10)}`;

  const handleDownloadBackupCode = () => {
    const formattedCodes = backupCodes.map((code) => formatBackupCode(code)).join("\n");
    const blob = new Blob([formattedCodes], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formbricks-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="p-6">
        <h1 className="text-lg font-semibold" data-testid="backup-codes-title">
          {t("environments.settings.profile.enable_two_factor_authentication")}
        </h1>
        <h3 className="text-sm text-slate-700" data-testid="backup-codes-description">
          {t("environments.settings.profile.save_the_following_backup_codes_in_a_safe_place")}
        </h3>
      </div>

      <div
        className="mx-auto mb-6 grid max-w-[60%] grid-cols-2 gap-1 text-center"
        data-testid="backup-codes-grid">
        {backupCodes.map((code) => (
          <p key={code} className="text-sm font-medium text-slate-700" data-testid={`backup-code-${code}`}>
            {formatBackupCode(code)}
          </p>
        ))}
      </div>

      <div className="flex w-full items-center justify-end space-x-4 border-t border-slate-300 p-4">
        <Button
          variant="secondary"
          type="button"
          size="sm"
          onClick={() => setOpen(false)}
          data-testid="close-button">
          {t("common.close")}
        </Button>

        <Button
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(backupCodes.map((code) => formatBackupCode(code)).join("\n"));
            toast.success(t("common.copied_to_clipboard"));
          }}
          data-testid="copy-button">
          {t("common.copy")}
        </Button>

        <Button
          size="sm"
          onClick={() => {
            handleDownloadBackupCode();
          }}
          data-testid="download-button">
          {t("common.download")}
        </Button>
      </div>
    </div>
  );
};
