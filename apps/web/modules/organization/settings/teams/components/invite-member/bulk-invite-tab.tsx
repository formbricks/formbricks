"use client";

import { ZInvitees } from "@/modules/organization/settings/teams/types/invites";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Uploader } from "@/modules/ui/components/file-input/components/uploader";
import { useTranslate } from "@tolgee/react";
import { XIcon } from "lucide-react";
import Link from "next/link";
import Papa, { type ParseResult } from "papaparse";
import { useState } from "react";
import toast from "react-hot-toast";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface BulkInviteTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: TOrganizationRole }[]) => void;
  isFormbricksCloud: boolean;
}

export const BulkInviteTab = ({ setOpen, onSubmit, isFormbricksCloud }: BulkInviteTabProps) => {
  const { t } = useTranslate();
  const [csvFile, setCSVFile] = useState<File>();

  const onFileInputChange = (files: File[]) => {
    const file = files[0];
    setCSVFile(file);
  };

  const onImport = () => {
    if (!csvFile) {
      return;
    }
    Papa.parse(csvFile, {
      skipEmptyLines: true,
      comments: "Full Name,Email Address,Role",
      complete: (results: ParseResult<string[]>) => {
        const members = results.data.map((csv) => {
          const [name, email, role] = csv;

          let orgRole = "owner";
          if (!isFormbricksCloud) {
            orgRole = orgRole === "billing" ? "owner" : orgRole;
          }

          return {
            name: name.trim(),
            email: email.trim(),
            role: orgRole as TOrganizationRole,
            teamIds: [],
          };
        });
        try {
          ZInvitees.parse(members);
          onSubmit(members);
        } catch (err) {
          console.error(err.message);
          toast.error(t("environments.settings.general.please_check_csv_file"));
        }
        setOpen(false);
      },
    });
  };

  const removeFile = () => {
    setCSVFile(undefined);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    if (!file.name.endsWith(".csv")) {
      toast.error(t("common.invalid_file_type"));
      return;
    }

    onFileInputChange(files);
  };

  return (
    <>
      <div className="space-y-4">
        <Uploader
          allowedFileExtensions={["csv"]}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleUpload={onFileInputChange}
          id="bulk-invite"
          multiple={false}
          name="bulk-invite"
          disabled={csvFile !== undefined}
          uploaderClassName="h-20 bg-white border border-slate-200"
        />

        {csvFile && (
          <div className="flex items-center space-x-2">
            <p className="text-sm font-semibold text-slate-900">{csvFile.name}</p>
            <Button variant="secondary" size="sm" type="button" onClick={removeFile}>
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Alert variant="default" className="mt-1.5 flex items-start bg-slate-50">
          <AlertDescription className="ml-2">
            <p className="text-sm">
              <strong>{t("common.warning")}: </strong>
              {t("environments.settings.general.bulk_invite_warning_description")}
            </p>
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex justify-between">
        <Button
          size="default"
          type="button"
          variant="outline"
          onClick={() => {
            setOpen(false);
          }}>
          {t("common.cancel")}
        </Button>
        <div className="flex space-x-2">
          <Link
            download
            href="/sample-csv/formbricks-organization-members-template.csv"
            target="_blank"
            rel="noopener noreferrer">
            <Button variant="secondary" size="default">
              {t("common.download")} CSV template
            </Button>
          </Link>
          <Button onClick={onImport} size="default" disabled={!csvFile}>
            {t("common.import")}
          </Button>
        </div>
      </div>
    </>
  );
};
