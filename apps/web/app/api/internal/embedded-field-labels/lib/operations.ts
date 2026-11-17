import "server-only";
import { logger } from "@formbricks/logger";
import type { TV3ChartOperationContext } from "@/app/api/v3/charts/lib/access";
import { requireDashboardsAccess } from "@/app/api/v3/lib/dashboards-access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import {
  MAX_EMBEDDED_FIELD_LABELS_PER_WORKSPACE,
  normalizeEmbeddedFieldLabel,
} from "@/modules/ee/analysis/lib/embedded-field-label-limits";
import { setEmbeddedFieldLabel } from "@/modules/ee/analysis/lib/embedded-field-labels";
import type { TInternalEmbeddedFieldLabelBody } from "./schemas";

/**
 * `PUT /api/internal/embedded-field-labels` → 200 `{ data: { key, label } }`: name an imported
 * (embedded-data) key across the workspace, or clear the name (`label` empty or the key itself → `label:
 * null`), so every chart's legends, headers and the builder's pickers show it. Idempotent.
 *
 * A workspace-wide write, so it needs read & write on the workspace with the Dashboards add-on — what the
 * chart builder that offers it needs to save a chart. The name is display text only: it never reaches a
 * query or an AI prompt.
 */
export async function putInternalEmbeddedFieldLabel({
  body,
  auditLog,
  ...context
}: TV3ChartOperationContext & {
  body: TInternalEmbeddedFieldLabelBody;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  const { authentication, requestId, instance } = context;
  const log = logger.withContext({ requestId, workspaceId: body.workspaceId });

  try {
    const access = await requireDashboardsAccess(
      authentication,
      body.workspaceId,
      "readWrite",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    const label = normalizeEmbeddedFieldLabel(body.key, body.label);
    const result = await setEmbeddedFieldLabel({
      workspaceId: access.workspaceId,
      key: body.key,
      label,
      expectedLabel: body.expectedLabel,
    });

    if (result.kind === "workspaceGone") return problemForbidden(requestId, undefined, instance);
    if (result.kind === "stale") {
      return problemConflict(
        requestId,
        "This field was renamed by someone else since you opened it. Reload to see the current name.",
        instance
      );
    }
    if (result.kind === "limitReached") {
      return problemUnprocessableContent(requestId, "Too many renamed fields in this workspace", {
        instance,
        invalid_params: [
          {
            name: "key",
            reason: `A workspace can rename at most ${MAX_EMBEDDED_FIELD_LABELS_PER_WORKSPACE} fields. Clear a name first.`,
          },
        ],
      });
    }

    if (auditLog) {
      // Clearing a name that was never set touches no row; the workspace is then the target.
      auditLog.targetId = result.current?.id ?? result.previous?.id ?? access.workspaceId;
      auditLog.organizationId = access.organizationId;
      auditLog.oldObject = result.previous ?? undefined;
      auditLog.newObject = result.current ?? undefined;
    }

    return successResponse({ key: body.key, label: result.current?.label ?? null }, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, { log, requestId, instance, operation: "embeddedFieldLabels.put" });
  }
}
