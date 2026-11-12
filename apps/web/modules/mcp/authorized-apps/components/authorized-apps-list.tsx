"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RevokeOAuthConsentButton } from "@/app/(app)/account/settings/authorized-apps/components/RevokeOAuthConsentButton";
import type { TMcpConnectionResource } from "@/app/api/internal/mcp-grants/lib/serializers";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { getHostFromUrl } from "@/modules/auth/lib/oauth-client-metadata";
import { Button } from "@/modules/ui/components/button";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useMcpConnections } from "../hooks/use-mcp-connections";
import { EditMcpGrantDialog } from "./edit-mcp-grant-dialog";
import { McpGrantSummary } from "./mcp-grant-summary";

interface AuthorizedAppsListProps {
  locale: string;
}

/**
 * Authorized apps' list (ENG-7152): every MCP client the user connected, each with its grant as one chip
 * per category, and Edit and Revoke. A client connected twice (two registrations) is two rows.
 */
export const AuthorizedAppsList = ({ locale }: Readonly<AuthorizedAppsListProps>) => {
  const { t } = useTranslation();
  const { data, isPending, isError, error, refetch } = useMcpConnections();
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="space-y-2" aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 text-sm text-slate-600">
        <p>{getV3ApiErrorMessage(error, t("auth.oauth.authorized_apps_load_failed"))}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          {t("common.try_again")}
        </Button>
      </div>
    );
  }

  if (data.connections.length === 0) {
    return <p className="text-sm text-slate-600">{t("auth.oauth.no_authorized_apps")}</p>;
  }

  const clientNameOf = (connection: TMcpConnectionResource) =>
    connection.clientName ?? t("auth.oauth.unknown_client");
  const editing = data.connections.find((connection) => connection.clientId === editingClientId);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("auth.oauth.client")}</TableHead>
            <TableHead>{t("auth.oauth.permissions")}</TableHead>
            <TableHead>{t("auth.oauth.connected_at")}</TableHead>
            <TableHead>{t("common.updated_at")}</TableHead>
            <TableHead className="text-right">{t("common.action")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.connections.map((connection) => {
            const clientName = clientNameOf(connection);
            return (
              <TableRow key={connection.clientId} className="hover:bg-slate-100">
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{clientName}</p>
                    <p className="text-xs break-all text-slate-500">
                      {getHostFromUrl(connection.clientUri) ?? connection.clientUri ?? connection.clientId}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <McpGrantSummary
                    permissions={connection.permissions ?? {}}
                    isDashboardViewer={data.isDashboardViewer}
                  />
                </TableCell>
                <TableCell className="text-slate-600">
                  {formatDateTimeForDisplay(new Date(connection.connectedAt), locale)}
                </TableCell>
                <TableCell className="text-slate-600">
                  {formatDateTimeForDisplay(new Date(connection.updatedAt), locale)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {connection.permissions && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label={t("auth.oauth.edit_access_title", { clientName })}
                        onClick={() => setEditingClientId(connection.clientId)}>
                        {t("common.edit")}
                      </Button>
                    )}
                    <RevokeOAuthConsentButton consentId={connection.consentId} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {editing?.permissions && (
        <EditMcpGrantDialog
          connection={{ ...editing, permissions: editing.permissions }}
          clientName={clientNameOf(editing)}
          isDashboardViewer={data.isDashboardViewer}
          onClose={() => setEditingClientId(null)}
        />
      )}
    </>
  );
};
