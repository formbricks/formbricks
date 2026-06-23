"use client";

import { XIcon } from "lucide-react";
import Link from "next/link";
import Papa, { type ParseResult } from "papaparse";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { ZInvitees } from "@/modules/organization/settings/teams/types/invites";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Uploader } from "@/modules/ui/components/file-input/components/uploader";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

interface BulkInviteTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: TOrganizationRole; teamIds: string[] }[]) => void;
  isAccessControlAllowed: boolean;
  isFormbricksCloud: boolean;
  isStorageConfigured: boolean;
  isBulkInviteAllowed: boolean;
  enterpriseLicenseRequestFormUrl: string;
}

export const BulkInviteTab = ({
  setOpen,
  onSubmit,
  isAccessControlAllowed,
  isFormbricksCloud,
  isStorageConfigured,
  isBulkInviteAllowed,
  enterpriseLicenseRequestFormUrl,
}: BulkInviteTabProps) => {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;
  const [csvFile, setCSVFile] = useState<File>();

  const onFileInputChange = (files: File[]) => {
    const file = files[0];
    setCSVFile(file);
  };

  const onImport = () => {
    if (!csvFile || !isBulkInviteAllowed) {
      return;
    }
    Papa.parse(csvFile, {
      skipEmptyLines: true,
      header: true,
      transformHeader: (header) => {
        if (header === "Full Name") return "name";
        if (header === "Email Address") return "email";
        if (header === "Role") return "role";
        return header;
      },
      complete: (results: ParseResult<{ name: string; email: string; role: string }>) => {
        const members = results.data.map((csv) => {
          let orgRole = isAccessControlAllowed ? csv.role.trim().toLowerCase() : "owner";
          if (!isFormbricksCloud) {
            orgRole = orgRole === "billing" ? "owner" : orgRole;
          }

          return {
            name: csv.name.trim(),
            email: csv.email.trim(),
            role: orgRole as TOrganizationRole,
            teamIds: [],
          };
        });
        try {
          ZInvitees.parse(members);
          onSubmit(members);
        } catch (err) {
          toast.error(t("workspace.settings.general.please_check_csv_file"));
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

  if (!isBulkInviteAllowed) {
    const upgradeButtons: [ModalButton, ModalButton] = [
      {
        text: isFormbricksCloud ? t("common.upgrade_plan") : t("common.request_trial_license"),
        href: isFormbricksCloud
          ? `${workspaceBasePath}/settings/organization/billing`
          : enterpriseLicenseRequestFormUrl,
      },
      {
        text: t("common.learn_more"),
        href: "https://formbricks.com/docs/self-hosting/license",
      },
    ];

    return (
      <UpgradePrompt
        title={t("workspace.settings.teams.bulk_invite_scale_only_title")}
        description={t("workspace.settings.teams.bulk_invite_scale_only_description")}
        buttons={upgradeButtons}
        feature="bulk-invite"
      />
    );
  }

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
          isStorageConfigured={isStorageConfigured}
        />

        {csvFile && (
          <div className="flex items-center gap-x-2">
            <p className="text-sm font-semibold text-slate-900">{csvFile.name}</p>
            <Button variant="secondary" size="sm" type="button" onClick={removeFile}>
              <XIcon className="size-4" />
            </Button>
          </div>
        )}

        {!isAccessControlAllowed && (
          <Alert variant="default" className="mt-1.5 flex items-start bg-slate-50">
            <AlertDescription className="ml-2">
              <p className="text-sm">
                <strong>{t("common.warning")}: </strong>
                {t("workspace.settings.general.bulk_invite_warning_description")}
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex justify-between">
        <Link
          download
          href="/sample-csv/formbricks-organization-members-template.csv"
          target="_blank"
          rel="noopener noreferrer">
          <Button variant="secondary" size="default">
            {t("common.download")} CSV template
          </Button>
        </Link>
        <div className="flex gap-x-2">
          <Button
            size="default"
            type="button"
            variant="secondary"
            onClick={() => {
              setOpen(false);
            }}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onImport} size="default" disabled={!csvFile}>
            {t("common.import")}
          </Button>
        </div>
      </div>
    </>
  );
};
