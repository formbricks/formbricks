import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getTranslate } from "@/lingodotdev/server";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Card } from "@/modules/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import type { TRecentAuditEvent } from "../lib/audit-events";
import { TABLE_HEAD_CLASS, TableFrame } from "./section-heading";

interface AuditLogCardProps {
  /** Whether audit events are being recorded on this instance. */
  isRecording: boolean;
  /** Only owners and managers read the trail; everyone else sees the status alone. */
  events: TRecentAuditEvent[] | null;
  locale: string;
  timeZone: string;
}

export const AuditLogCard = async ({
  isRecording,
  events,
  locale,
  timeZone,
}: Readonly<AuditLogCardProps>) => {
  const t = await getTranslate();
  // Name-less actors: an API key or agent, the system itself, or a user who has since left.
  const actorLabels = {
    api: t("shell.organization.security.actor_api"),
    system: t("shell.organization.security.actor_system"),
    user: t("shell.organization.security.actor_former_member"),
  };

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[68ch]">
          <h2 className="text-base font-semibold text-slate-800">
            {t("shell.organization.security.audit_title")}
          </h2>
          <p className="mt-0.5 text-slate-600">{t("shell.organization.security.audit_description")}</p>
        </div>
        <Badge
          type={isRecording ? "success" : "gray"}
          size="normal"
          text={
            isRecording
              ? t("shell.organization.security.audit_recording")
              : t("shell.organization.security.audit_not_recording")
          }
        />
      </div>

      {!isRecording && (
        <Alert variant="info" role="status">
          <AlertDescription>{t("shell.organization.security.audit_disabled")}</AlertDescription>
        </Alert>
      )}

      {isRecording && events === null && (
        <p className="text-slate-500">{t("shell.organization.security.audit_managers_only")}</p>
      )}

      {isRecording && events !== null && (
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="font-medium text-slate-800">{t("shell.organization.security.audit_recent")}</h3>
            <p className="text-slate-500">{t("shell.organization.security.audit_agent_hint")}</p>
          </div>
          {events.length === 0 ? (
            <p className="rounded-lg border border-slate-200 p-4 text-center text-slate-500">
              {t("shell.organization.security.audit_empty")}
            </p>
          ) : (
            <TableFrame>
              <Table aria-label={t("shell.organization.security.audit_title")}>
                <TableHeader>
                  <TableRow>
                    <TableHead className={TABLE_HEAD_CLASS}>
                      {t("shell.organization.security.when")}
                    </TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>
                      {t("shell.organization.security.actor")}
                    </TableHead>
                    <TableHead className={TABLE_HEAD_CLASS}>
                      {t("shell.organization.security.action")}
                    </TableHead>
                    <TableHead className={`${TABLE_HEAD_CLASS} hidden md:table-cell`}>
                      {t("shell.organization.security.result")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-slate-600">
                        {formatDateTimeForDisplay(event.timestamp, locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone,
                        })}
                      </TableCell>
                      <TableCell className="ph-no-capture">
                        {event.actorName ?? actorLabels[event.actorType]}
                      </TableCell>
                      {/* The audit vocabulary (`created`, `survey`, ...) is machine-facing and stays as recorded. */}
                      <TableCell>
                        <span className="font-mono text-xs text-slate-700">
                          {event.targetType}.{event.action}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          type={event.status === "success" ? "success" : "error"}
                          size="normal"
                          text={
                            event.status === "success"
                              ? t("shell.organization.security.result_success")
                              : t("shell.organization.security.result_failed")
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableFrame>
          )}
        </div>
      )}
    </Card>
  );
};
