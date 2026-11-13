"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TAuthorizedMcpClientResource } from "@/app/api/internal/mcp-grants/lib/serializers";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { getHostFromUrl } from "@/modules/auth/lib/oauth-client-metadata";
import { isMcpGrantEmpty } from "@/modules/mcp/grant-editor";
import { Button } from "@/modules/ui/components/button";
import { Skeleton } from "@/modules/ui/components/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useAuthorizedMcpClients } from "../hooks/use-authorized-mcp-clients";
import { EditMcpGrantDialog } from "./edit-mcp-grant-dialog";
import { McpGrantSummary } from "./mcp-grant-summary";
import { RevokeMcpGrantButton } from "./revoke-mcp-grant-button";

interface AuthorizedAppsListProps {
  locale: string;
}

/**
 * Authorized apps' list (ENG-7152): every MCP client the user connected, each with its grant as one chip
 * per category, and Edit and Revoke. A client registered twice is two rows, and a client authorized
 * without the consent screen (`skipConsent`) is listed like any other.
 */
export const AuthorizedAppsList = ({ locale }: Readonly<AuthorizedAppsListProps>) => {
  const { t } = useTranslation();
  const { data, isPending, isError, error, refetch } = useAuthorizedMcpClients();
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

  if (data.clients.length === 0) {
    return <p className="text-sm text-slate-600">{t("auth.oauth.no_authorized_apps")}</p>;
  }

  const clientNameOf = (client: TAuthorizedMcpClientResource) =>
    client.clientName ?? t("auth.oauth.unknown_client");
  const editing = data.clients.find((client) => client.clientId === editingClientId);

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
          {data.clients.map((client) => {
            const clientName = clientNameOf(client);
            return (
              <TableRow key={client.clientId} className="hover:bg-slate-100">
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{clientName}</p>
                    <p className="text-xs break-all text-slate-500">
                      {getHostFromUrl(client.clientUri) ?? client.clientUri ?? client.clientId}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <McpGrantSummary
                    permissions={client.permissions ?? {}}
                    access={client.access}
                    isDashboardViewer={data.isDashboardViewer}
                  />
                </TableCell>
                <TableCell className="text-slate-600">
                  {formatDateTimeForDisplay(new Date(client.connectedAt), locale)}
                </TableCell>
                <TableCell className="text-slate-600">
                  {formatDateTimeForDisplay(new Date(client.updatedAt), locale)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {/* A client capped at nothing (no consent, no `skipConsent`) has nothing Edit could give. */}
                    {client.permissions && !isMcpGrantEmpty(client.cap) && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label={t("auth.oauth.edit_access_title", { clientName })}
                        onClick={() => setEditingClientId(client.clientId)}>
                        {t("common.edit")}
                      </Button>
                    )}
                    <RevokeMcpGrantButton clientId={client.clientId} clientName={clientName} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {editing?.permissions && editing.access && (
        <EditMcpGrantDialog
          client={{ ...editing, permissions: editing.permissions, access: editing.access }}
          accessOptions={data.accessOptions}
          clientName={clientNameOf(editing)}
          isDashboardViewer={data.isDashboardViewer}
          onClose={() => setEditingClientId(null)}
        />
      )}
    </>
  );
};
