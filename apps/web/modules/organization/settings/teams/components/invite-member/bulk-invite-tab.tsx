"use client";

import type { TFunction } from "i18next";
import { ArrowUpFromLineIcon } from "lucide-react";
import Link from "next/link";
import Papa, { type ParseResult } from "papaparse";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getDroppedFiles, setDropEffect } from "@formbricks/survey-ui/drag-data";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { cn } from "@/lib/cn";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  useBulkSetMemberAttributes,
  useMemberAttributeKeys,
  useMemberAttributeRows,
} from "@/modules/ee/member-attributes/hooks/use-member-attributes";
import type { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import {
  findRefusedBulkInviteRoles,
  parseRoleCell,
} from "@/modules/organization/settings/teams/lib/bulk-invite-roles";
import {
  type TCsvAttributeKey,
  type TMemberCsvPlan,
  buildMemberCsvTemplate,
  planMemberCsvImport,
  toBulkAttributeRows,
} from "@/modules/organization/settings/teams/lib/member-csv-import";
import { ZInvitees } from "@/modules/organization/settings/teams/types/invites";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { CsvTable } from "@/modules/ui/components/csv-table";
import { DialogFooter } from "@/modules/ui/components/dialog";
import { ModalButton, UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

interface BulkInviteTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (
    data: { name: string; email: string; role: TOrganizationRole; teamIds: string[] }[]
  ) => Promise<boolean>;
  teams: TOrganizationTeam[];
  organizationId: string;
  isAccessControlAllowed: boolean;
  isFormbricksCloud: boolean;
  isDashboardViewerRoleEnabled: boolean;
  isBulkInviteAllowed: boolean;
  membershipRole?: TOrganizationRole;
  enterpriseLicenseRequestFormUrl: string;
  /**
   * Member attributes are on and the inviter may set them (ENG-7475): the file then also updates existing
   * members' and invites' attributes, through the v3 bulk endpoint.
   */
  isMemberAttributesEnabled?: boolean;
}

/** What the attribute-aware import needs, read through the v3 endpoints. */
type TAttributeImportContext = {
  keys: TCsvAttributeKey[];
  existingEmails: string[];
  isLoading: boolean;
  applyAttributes: (
    rows: { email: string; attributes: Record<string, string[]> }[]
  ) => Promise<{ updatedMembers: number; updatedInvites: number; unknownEmails: number; invalid: number }>;
};

export type BulkCsvRow = Record<string, string | undefined>;

const PREVIEW_ROW_LIMIT = 11;

// Guards ENG-1596: a missing/misnamed CSV column yields undefined at runtime (the
// PapaParse generic is a compile-time lie), so cell access must never assume string.
// Returning "" lets ZInvitees validation reject the row and surface the CSV error
// instead of a TypeError crash that silently closes the modal.
export const readCell = (row: BulkCsvRow, ...keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
};

export const parseTeamCell = (cell: string | undefined): string[] => {
  if (!cell) return [];
  return cell
    .split(/[,|]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
};

type TInviteRow = { name: string; email: string; roleCell: string; teamsCell: string };

/** Why the import cannot run as planned, or null. */
const getPlanError = (plan: TMemberCsvPlan, t: TFunction): string | null => {
  if (plan.tooManyRows) {
    return t("workspace.settings.members.csv_too_many_rows", { max: plan.entries.length });
  }
  if (plan.summary.invalid === 0) return null;
  return t("workspace.settings.members.csv_fix_invalid_rows", {
    rows: plan.entries
      .filter((entry) => entry.action === "invalid")
      .map((entry) => entry.rowNumber)
      .join(", "),
  });
};

/** The rows to invite: the plan's new emails, or (without Member attributes) every row, as before. */
const toInviteRows = (plan: TMemberCsvPlan | null, previewRows: readonly BulkCsvRow[]): TInviteRow[] =>
  plan
    ? plan.entries
        .filter((entry) => entry.action === "invite")
        .map(({ name, email, roleCell, teamsCell }) => ({ name, email, roleCell, teamsCell }))
    : previewRows.map((csv) => ({
        name: readCell(csv, "Full Name", "name").trim(),
        email: readCell(csv, "Email Address", "email").trim(),
        roleCell: readCell(csv, "Organization Role", "Role", "role"),
        teamsCell: readCell(csv, "Teams", "teams"),
      }));

/** Invitees with their role and team ids, and the team names the organization does not have. */
const buildInvitees = (
  inviteRows: readonly TInviteRow[],
  teams: readonly TOrganizationTeam[],
  isAccessControlAllowed: boolean
) => {
  const teamByName = new Map(teams.map((team) => [team.name.trim().toLowerCase(), team]));
  const unknownTeamNames = new Set<string>();
  const members = inviteRows.map(({ name, email, roleCell, teamsCell }) => {
    const teamIds: string[] = [];
    if (isAccessControlAllowed) {
      for (const teamName of parseTeamCell(teamsCell)) {
        const match = teamByName.get(teamName.toLowerCase());
        if (!match) unknownTeamNames.add(teamName);
        else if (!teamIds.includes(match.id)) teamIds.push(match.id);
      }
    }
    return {
      name,
      email,
      role: parseRoleCell(roleCell, isAccessControlAllowed) as TOrganizationRole,
      teamIds,
    };
  });
  return { members, unknownTeamNames: [...unknownTeamNames] };
};

/** The first role the inviter may not give, as the error to show, or null. */
const getRefusedRoleError = (
  refused: { billing: string[]; dashboardViewer: string[]; other: string[] },
  t: TFunction
): string | null => {
  if (refused.billing.length > 0) {
    return t("workspace.settings.general.bulk_invite_billing_not_supported", {
      emails: refused.billing.join(", "),
    });
  }
  if (refused.dashboardViewer.length > 0) {
    return t("workspace.settings.general.bulk_invite_dashboard_viewer_not_available", {
      emails: refused.dashboardViewer.join(", "),
    });
  }
  if (refused.other.length > 0) {
    return t("workspace.settings.general.bulk_invite_role_not_allowed", { emails: refused.other.join(", ") });
  }
  return null;
};

/** Reads the attribute keys and who already exists, so the preview can tell an invite from an update. */
const BulkInviteTabWithAttributes = (props: Readonly<BulkInviteTabProps>) => {
  const keysQuery = useMemberAttributeKeys({ organizationId: props.organizationId });
  const rowsQuery = useMemberAttributeRows({ organizationId: props.organizationId });
  const bulkMutation = useBulkSetMemberAttributes(props.organizationId);
  const context = useMemo<TAttributeImportContext>(
    () => ({
      keys: (keysQuery.data ?? []).map(({ key, label }) => ({ key, label })),
      existingEmails: (rowsQuery.data ?? []).map((row) => row.email),
      isLoading: keysQuery.isLoading || rowsQuery.isLoading,
      applyAttributes: async (rows) => (await bulkMutation.mutateAsync(rows)).summary,
    }),
    [keysQuery.data, keysQuery.isLoading, rowsQuery.data, rowsQuery.isLoading, bulkMutation]
  );
  return <BulkInviteTabBody {...props} attributeContext={context} />;
};

export const BulkInviteTab = (props: Readonly<BulkInviteTabProps>) =>
  props.isMemberAttributesEnabled ? (
    <BulkInviteTabWithAttributes {...props} />
  ) : (
    <BulkInviteTabBody {...props} attributeContext={null} />
  );

const downloadCsv = (filename: string, csv: string) => {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const BulkInviteTabBody = ({
  setOpen,
  onSubmit,
  teams,
  organizationId,
  isAccessControlAllowed,
  isFormbricksCloud,
  isDashboardViewerRoleEnabled,
  isBulkInviteAllowed,
  membershipRole,
  enterpriseLicenseRequestFormUrl,
  attributeContext,
}: Readonly<BulkInviteTabProps & { attributeContext: TAttributeImportContext | null }>) => {
  const { t } = useTranslation();
  const [csvFile, setCSVFile] = useState<File>();
  const [previewRows, setPreviewRows] = useState<BulkCsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);

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
        // FieldMismatch (TooFewFields/TooManyFields) is non-fatal: the row still parses,
        // missing cells come back undefined and are caught by schema validation on import.
        const fatalErrors = results.errors.filter((parseError) => parseError.type !== "FieldMismatch");
        if (fatalErrors.length > 0) {
          setError(t("workspace.settings.general.please_check_csv_file"));
          setPreviewRows([]);
          return;
        }
        setPreviewRows(results.data);
        setHeaders(results.meta.fields ?? []);
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
    setDropEffect(e, "copy");
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelected(getDroppedFiles(e)[0]);
  };

  const resetFile = () => {
    setCSVFile(undefined);
    setPreviewRows([]);
    setHeaders([]);
    setError("");
  };

  // One file for new and existing members: which rows invite and which update, decided once for both
  // the preview and the import.
  const plan: TMemberCsvPlan | null = useMemo(
    () =>
      attributeContext && previewRows.length > 0
        ? planMemberCsvImport({
            headers,
            rows: previewRows,
            attributeKeys: attributeContext.keys,
            existingEmails: attributeContext.existingEmails,
          })
        : null,
    [attributeContext, headers, previewRows]
  );

  /** Sets the file's attributes through the bulk endpoint; false when it failed, with the error shown. */
  const applyAttributes = async (
    attributeRows: { email: string; attributes: Record<string, string[]> }[]
  ): Promise<boolean> => {
    if (!attributeContext) return true;
    try {
      const summary = await attributeContext.applyAttributes(attributeRows);
      toast.success(
        t("workspace.settings.members.csv_attributes_applied", {
          count: summary.updatedMembers + summary.updatedInvites,
        })
      );
      return true;
    } catch (applyError) {
      setError(getV3ApiErrorMessage(applyError, t("common.something_went_wrong_please_try_again")));
      return false;
    }
  };

  const onImport = async () => {
    if (!csvFile || !previewRows.length || !isBulkInviteAllowed || isImporting) {
      return;
    }

    const planError = plan ? getPlanError(plan, t) : null;
    if (planError) {
      setError(planError);
      return;
    }

    // With Member attributes, existing members and invites keep their role and teams: only new emails
    // are invited. Without, every row is an invite, as before.
    const { members, unknownTeamNames } = buildInvitees(
      toInviteRows(plan, previewRows),
      teams,
      isAccessControlAllowed
    );
    if (unknownTeamNames.length > 0) {
      setError(
        t("workspace.settings.general.bulk_invite_unknown_teams", { teams: unknownTeamNames.join(", ") })
      );
      return;
    }

    // Without Access Control every row is an Owner invite, decided by the server as before.
    const roleError = isAccessControlAllowed
      ? getRefusedRoleError(
          findRefusedBulkInviteRoles(members, {
            assignerRole: membershipRole,
            isFormbricksCloud,
            isDashboardViewerRoleEnabled,
          }),
          t
        )
      : null;
    if (roleError) {
      setError(roleError);
      return;
    }

    const parsed = ZInvitees.safeParse(members);
    if (!parsed.success) {
      setError(t("workspace.settings.general.please_check_csv_file"));
      return;
    }

    setIsImporting(true);
    try {
      // Invites first, so the attribute rows below find the new invites by email.
      const invited = parsed.data.length > 0 ? await onSubmit(parsed.data) : true;
      const attributeRows = plan ? toBulkAttributeRows(plan) : [];
      if (attributeRows.length > 0 && attributeContext && !(await applyAttributes(attributeRows))) return;
      if (invited || attributeRows.length > 0) {
        setOpen(false);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const previewCount = previewRows.length;

  if (!isBulkInviteAllowed) {
    const upgradeButtons: [ModalButton, ModalButton] = [
      {
        text: isFormbricksCloud ? t("common.upgrade_plan") : t("common.request_trial_license"),
        href: isFormbricksCloud
          ? organizationSettingsPath(organizationId, "billing")
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
      <div className="flex flex-col gap-4">
        {attributeContext && (
          <Alert variant="info" alertRole="status">
            <AlertDescription className="whitespace-normal">
              <strong>{t("workspace.settings.members.csv_one_file_title")}</strong>{" "}
              {t("workspace.settings.members.csv_one_file_description")}
            </AlertDescription>
          </Alert>
        )}
        {error ? (
          <Alert variant="error">
            <AlertDescription className="break-words whitespace-normal">{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="no-scrollbar rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4">
            {csvFile ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <h3 className="font-medium text-slate-700">{csvFile.name}</h3>
                {plan ? <MemberCsvPreview plan={plan} /> : <PlainCsvPreview previewRows={previewRows} />}
              </div>
            ) : (
              <label
                htmlFor="bulk-invite-file"
                className={cn(
                  "relative flex cursor-pointer flex-col items-center justify-center rounded-lg hover:bg-slate-100"
                )}
                onDragOver={handleDragOver}
                onDrop={handleDrop}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
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
            )}
          </div>

          {csvFile ? null : <TemplateDownload attributeContext={attributeContext} />}
        </div>

        {!isAccessControlAllowed && (
          <Alert variant="default" className="mt-1.5 flex items-start bg-slate-50" alertRole="status">
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
        <Button
          onClick={() => void onImport()}
          disabled={!csvFile || !previewCount || isImporting || Boolean(attributeContext?.isLoading)}
          loading={isImporting}>
          {t("common.import")}
        </Button>
      </DialogFooter>
    </>
  );
};

/**
 * The import's preview with Member attributes (ENG-7475): the member columns, one column per attribute the
 * file sets, and what each row will do — Invite, Update, or why it is invalid — with a summary line and the
 * columns that will be ignored.
 */
const MemberCsvPreview = ({ plan }: Readonly<{ plan: TMemberCsvPlan }>) => {
  const { t } = useTranslation();
  const shown = plan.entries.slice(0, PREVIEW_ROW_LIMIT);
  const summary = [
    t("workspace.settings.general.bulk_invite_rows_detected", { count: plan.summary.rows }),
    t("workspace.settings.members.csv_new_members", { count: plan.summary.invites }),
    t("workspace.settings.members.csv_attribute_updates", { count: plan.summary.updates }),
    ...(plan.summary.invalid > 0
      ? [t("workspace.settings.members.csv_invalid_rows", { count: plan.summary.invalid })]
      : []),
  ].join(" · ");

  return (
    <>
      <div className="max-h-[300px] w-full overflow-auto rounded-md border border-slate-300 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-2 py-1.5 font-medium">Full Name</th>
              <th className="px-2 py-1.5 font-medium">Email Address</th>
              <th className="px-2 py-1.5 font-medium">Organization Role</th>
              <th className="px-2 py-1.5 font-medium">Teams</th>
              {plan.attributeColumns.map((column) => (
                <th key={column.key} className="px-2 py-1.5 font-medium">
                  {column.label}
                </th>
              ))}
              <th className="px-2 py-1.5 font-medium">{t("workspace.settings.members.csv_action")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((entry) => (
              <tr key={entry.rowNumber} className="border-t border-slate-200 text-slate-700">
                <td className="ph-no-capture px-2 py-1.5">{entry.name}</td>
                <td className="ph-no-capture px-2 py-1.5">{entry.email}</td>
                <td className="px-2 py-1.5">{entry.action === "update" ? "—" : entry.roleCell}</td>
                <td className="px-2 py-1.5">{entry.action === "update" ? "—" : entry.teamsCell}</td>
                {plan.attributeColumns.map((column) => (
                  <td key={column.key} className="ph-no-capture px-2 py-1.5">
                    {(entry.attributes[column.key] ?? []).join(", ")}
                  </td>
                ))}
                <td className="px-2 py-1.5 font-medium">
                  {entry.action === "invite" && t("workspace.settings.members.csv_invite")}
                  {entry.action === "update" && t("workspace.settings.members.csv_update")}
                  {entry.action === "invalid" && (
                    <span className="text-red-700">{t("workspace.settings.members.csv_invalid")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{summary}</p>
      {plan.unknownColumns.length > 0 && (
        <p className="text-xs text-amber-700">
          {t("workspace.settings.members.csv_unknown_columns", { columns: plan.unknownColumns.join(", ") })}
        </p>
      )}
    </>
  );
};

/** The file's rows as they are, for an import without Member attributes (as before ENG-7475). */
const PlainCsvPreview = ({ previewRows }: Readonly<{ previewRows: BulkCsvRow[] }>) => {
  const { t } = useTranslation();
  const previewCount = previewRows.length;
  const extraRowCount = Math.max(previewCount - PREVIEW_ROW_LIMIT, 0);
  if (previewCount === 0) {
    return (
      <p className="text-xs text-slate-500">
        {t("workspace.settings.general.bulk_invite_rows_detected", { count: 0 })}
      </p>
    );
  }
  return (
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
  );
};

/**
 * Download CSV template: with Member attributes it is built here, with a column per attribute key (every
 * cell defanged by `toCsvLine`); without, the static template as before.
 */
const TemplateDownload = ({
  attributeContext,
}: Readonly<{ attributeContext: TAttributeImportContext | null }>) => {
  const { t } = useTranslation();
  if (!attributeContext) {
    return (
      <div className="flex justify-start">
        <Link
          download
          href="/sample-csv/formbricks-organization-members-template.csv"
          target="_blank"
          rel="noopener noreferrer">
          <Button variant="secondary">{t("workspace.settings.general.bulk_invite_download_template")}</Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <Button
        variant="secondary"
        type="button"
        disabled={attributeContext.isLoading}
        onClick={() =>
          downloadCsv(
            "formbricks-organization-members-template.csv",
            buildMemberCsvTemplate(attributeContext.keys)
          )
        }>
        {t("workspace.settings.general.bulk_invite_download_template")}
      </Button>
    </div>
  );
};
