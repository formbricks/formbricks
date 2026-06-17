"use client";

import { ArrowUpFromLineIcon } from "lucide-react";
import Link from "next/link";
import Papa, { type ParseResult } from "papaparse";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { cn } from "@/lib/cn";
import type { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { ZInvitees } from "@/modules/organization/settings/teams/types/invites";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { CsvTable } from "@/modules/ui/components/csv-table";
import { DialogFooter } from "@/modules/ui/components/dialog";

interface BulkInviteTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: TOrganizationRole; teamIds: string[] }[]) => void;
  teams: TOrganizationTeam[];
  isAccessControlAllowed: boolean;
  isFormbricksCloud: boolean;
}

type BulkCsvRow = Record<string, string | undefined>;

const PREVIEW_ROW_LIMIT = 11;

const readCell = (row: BulkCsvRow, ...keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
};

const parseTeamCell = (cell: string | undefined): string[] => {
  if (!cell) return [];
  return cell
    .split(/[,|]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
};

export const BulkInviteTab = ({
  setOpen,
  onSubmit,
  teams,
  isAccessControlAllowed,
  isFormbricksCloud,
}: BulkInviteTabProps) => {
  const { t } = useTranslation();
  const [csvFile, setCSVFile] = useState<File>();
  const [previewRows, setPreviewRows] = useState<BulkCsvRow[]>([]);
  const [error, setError] = useState<string>("");
  const errorContainerRef = useRef<HTMLDivElement | null>(null);

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;

    setPreviewRows([]);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError(t("common.invalid_file_type"));
      return;
    }

    setError("");
    setCSVFile(file);

    Papa.parse<BulkCsvRow>(file, {
      skipEmptyLines: true,
      header: true,
      complete: (results: ParseResult<BulkCsvRow>) => {
        setPreviewRows(results.data);
      },
      error: () => {
        setError(t("workspace.settings.general.please_check_csv_file"));
        setPreviewRows([]);
      },
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelected(e.dataTransfer.files[0]);
  };

  const resetFile = () => {
    setCSVFile(undefined);
    setPreviewRows([]);
    setError("");
  };

  const onImport = () => {
    if (!csvFile || !previewRows.length) {
      return;
    }

    const teamByName = new Map(teams.map((team) => [team.name.trim().toLowerCase(), team]));
    const unknownTeamNames = new Set<string>();

    const members = previewRows.map((csv) => {
      const roleCell = readCell(csv, "Role", "role");
      let orgRole = isAccessControlAllowed ? roleCell.trim().toLowerCase() : "owner";
      if (!isFormbricksCloud) {
        orgRole = orgRole === "billing" ? "owner" : orgRole;
      }

      const teamsCell = readCell(csv, "Teams", "teams");
      const teamIds = isAccessControlAllowed
        ? parseTeamCell(teamsCell).reduce<string[]>((acc, teamName) => {
            const match = teamByName.get(teamName.toLowerCase());
            if (match) {
              if (!acc.includes(match.id)) {
                acc.push(match.id);
              }
            } else {
              unknownTeamNames.add(teamName);
            }
            return acc;
          }, [])
        : [];

      return {
        name: readCell(csv, "Full Name", "name").trim(),
        email: readCell(csv, "Email Address", "email").trim(),
        role: orgRole as TOrganizationRole,
        teamIds,
      };
    });

    if (unknownTeamNames.size > 0) {
      setError(
        t("workspace.settings.general.bulk_invite_unknown_teams", {
          teams: Array.from(unknownTeamNames).join(", "),
        })
      );
      return;
    }

    const parsed = ZInvitees.safeParse(members);
    if (!parsed.success) {
      setError(t("workspace.settings.general.please_check_csv_file"));
      return;
    }

    onSubmit(parsed.data);
    setOpen(false);
  };

  const previewCount = previewRows.length;
  const extraRowCount = Math.max(previewCount - PREVIEW_ROW_LIMIT, 0);

  return (
    <>
      <div className="flex flex-col gap-4">
        {error ? (
          <div ref={errorContainerRef}>
            <Alert variant="error" size="small">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="no-scrollbar rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4">
            {!csvFile ? (
              <label
                htmlFor="bulk-invite-file"
                className={cn(
                  "relative flex cursor-pointer flex-col items-center justify-center rounded-lg hover:bg-slate-100"
                )}
                onDragOver={handleDragOver}
                onDrop={handleDrop}>
                <div className="flex flex-col items-center justify-center pb-6 pt-5">
                  <ArrowUpFromLineIcon className="h-6 text-slate-500" />
                  <p className="mt-2 text-center text-sm text-slate-500">
                    <span className="font-semibold">{t("common.upload_input_description")}</span>
                  </p>
                  <input
                    type="file"
                    id="bulk-invite-file"
                    name="bulk-invite-file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files?.[0])}
                  />
                </div>
              </label>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <h3 className="font-medium text-slate-700">{csvFile.name}</h3>
                {previewCount > 0 ? (
                  <>
                    <div className="max-h-[300px] w-full overflow-auto rounded-md border border-slate-300">
                      <CsvTable data={previewRows.slice(0, PREVIEW_ROW_LIMIT)} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {t("workspace.settings.general.bulk_invite_rows_detected", { count: previewCount })}
                      {extraRowCount > 0
                        ? ` · ${t("workspace.settings.general.bulk_invite_rows_more", { count: extraRowCount })}`
                        : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">
                    {t("workspace.settings.general.bulk_invite_rows_detected", { count: 0 })}
                  </p>
                )}
              </div>
            )}
          </div>

          {!csvFile && (
            <div className="flex justify-start">
              <Link
                download
                href="/sample-csv/formbricks-organization-members-template.csv"
                target="_blank"
                rel="noopener noreferrer">
                <Button variant="secondary">
                  {t("workspace.settings.general.bulk_invite_download_template")}
                </Button>
              </Link>
            </div>
          )}
        </div>

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

      <DialogFooter>
        {csvFile ? (
          <Button variant="secondary" type="button" onClick={resetFile}>
            {t("workspace.contacts.upload_contacts_modal_pick_different_file")}
          </Button>
        ) : null}
        <Button onClick={onImport} disabled={!csvFile || !previewCount}>
          {t("common.import")}
        </Button>
      </DialogFooter>
    </>
  );
};
