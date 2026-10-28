"use client";

import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { Button } from "@/modules/ui/components/button";

interface DisplayBackupCodesProps {
  backupCodes: string[];
  setOpen: (open: boolean) => void;
}

export const DisplayBackupCodes = ({ backupCodes, setOpen }: Readonly<DisplayBackupCodesProps>) => {
  const { t } = useTranslation();
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
    <div className="flex flex-col gap-5">
      <div
        className="mx-auto grid w-full max-w-72 grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center"
        data-testid="backup-codes-grid">
        {backupCodes.map((code) => (
          <p
            key={code}
            className="font-mono text-sm font-medium text-slate-800"
            data-testid={`backup-code-${code}`}>
            {formatBackupCode(code)}
          </p>
        ))}
      </div>

      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => setOpen(false)} data-testid="close-button">
          {t("common.close")}
        </Button>

        <Button
          variant="outline"
          type="button"
          onClick={async () => {
            if (await copyToClipboard(backupCodes.map((code) => formatBackupCode(code)).join("\n"))) {
              toast.success(t("common.copied_to_clipboard"));
            } else {
              toast.error(t("common.failed_to_copy_to_clipboard"));
            }
          }}
          data-testid="copy-button">
          {t("common.copy")}
        </Button>

        <Button
          type="button"
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
