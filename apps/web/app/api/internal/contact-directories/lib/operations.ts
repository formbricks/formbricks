import "server-only";
import {
  createdResponse,
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import {
  ContactDirectoryNameRequiredError,
  ContactDirectoryNameTakenError,
  ContactDirectoryNotFoundError,
  ContactDirectoryWorkspacesCannotLeaveError,
  ContactDirectoryWorkspacesNotFoundError,
  ContactDirectoryWorkspacesNotMovableError,
} from "@/modules/ee/contacts/directories/lib/directory-errors";
import {
  createContactDirectory,
  getContactDirectory,
  listContactDirectories,
  updateContactDirectory,
} from "@/modules/ee/contacts/directories/lib/directory-service";
import type {
  TContactDirectoriesQuery,
  TContactDirectoryCreateBody,
  TContactDirectoryUpdateBody,
} from "../schemas";
import { requireContactDirectoryAccess, requireContactDirectoryOrgAccess } from "./access";

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
};

const BASE_PATH = "/api/internal/contact-directories";

/** Maps the directory service's rule errors to problems; anything else propagates as a 500. */
const toProblem = (error: unknown, requestId: string, instance?: string): Response => {
  if (error instanceof ContactDirectoryNameRequiredError) {
    return problemUnprocessableContent(requestId, error.message, {
      instance,
      code: "contact_directory_name_required",
      invalid_params: [{ name: "name", reason: error.message, code: "missing_required_field" }],
    });
  }
  if (error instanceof ContactDirectoryNameTakenError) {
    return problemConflict(requestId, error.message, instance, { code: "contact_directory_name_taken" });
  }
  if (error instanceof ContactDirectoryWorkspacesNotFoundError) {
    return problemUnprocessableContent(requestId, error.message, {
      instance,
      invalid_params: [{ name: "workspaceIds", reason: error.message, code: "invalid_reference" }],
    });
  }
  if (error instanceof ContactDirectoryWorkspacesNotMovableError) {
    return problemConflict(requestId, error.message, instance, {
      code: "contact_directory_workspace_not_movable",
      details: { workspaceIds: error.workspaceIds },
    });
  }
  if (error instanceof ContactDirectoryWorkspacesCannotLeaveError) {
    return problemUnprocessableContent(requestId, error.message, {
      instance,
      code: "contact_directory_workspace_cannot_leave",
      details: { workspaceIds: error.workspaceIds },
    });
  }
  if (error instanceof ContactDirectoryNotFoundError) {
    return problemForbidden(requestId, undefined, instance);
  }
  throw error;
};

/** Every directory of the organization with every workspace, for the settings list and the picker. */
export async function listContactDirectoriesOperation({
  query,
  ...context
}: TRequestContext & { query: TContactDirectoriesQuery }): Promise<Response> {
  const access = await requireContactDirectoryOrgAccess({ ...context, organizationId: query.organizationId });
  if (access instanceof Response) return access;

  return successResponse(await listContactDirectories(access.organizationId), {
    requestId: context.requestId,
  });
}

export async function createContactDirectoryOperation({
  query,
  body,
  auditLog,
  ...context
}: TRequestContext & {
  query: TContactDirectoriesQuery;
  body: TContactDirectoryCreateBody;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  // What was asked for, so a refused attempt is still attributable in the audit log.
  if (auditLog) auditLog.newObject = { ...body };

  const access = await requireContactDirectoryOrgAccess({ ...context, organizationId: query.organizationId });
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  let created: { id: string };
  try {
    created = await createContactDirectory({
      organizationId: access.organizationId,
      name: body.name,
      matchingKey: body.matchingKey,
      workspaceIds: body.workspaceIds,
    });
  } catch (error) {
    return toProblem(error, context.requestId, context.instance);
  }

  const directory = await getContactDirectory(access.organizationId, created.id);
  if (auditLog) {
    auditLog.targetId = created.id;
    auditLog.newObject = {
      name: directory?.name ?? null,
      matchingKey: body.matchingKey,
      workspaceIds: directory?.workspaces.map(({ id }) => id) ?? body.workspaceIds,
    };
  }

  return createdResponse(directory, {
    location: `${BASE_PATH}/${created.id}`,
    requestId: context.requestId,
  });
}

export async function getContactDirectoryOperation({
  directoryId,
  ...context
}: TRequestContext & { directoryId: string }): Promise<Response> {
  const access = await requireContactDirectoryAccess({ ...context, directoryId });
  if (access instanceof Response) return access;

  const directory = await getContactDirectory(access.organizationId, directoryId);
  if (!directory) return problemForbidden(context.requestId, undefined, context.instance);

  return successResponse(directory, { requestId: context.requestId });
}

export async function updateContactDirectoryOperation({
  directoryId,
  body,
  auditLog,
  ...context
}: TRequestContext & {
  directoryId: string;
  body: TContactDirectoryUpdateBody;
  auditLog?: TV3AuditLog;
}): Promise<Response> {
  if (auditLog) {
    auditLog.targetId = directoryId;
    auditLog.newObject = { ...body };
  }

  const access = await requireContactDirectoryAccess({ ...context, directoryId });
  if (access instanceof Response) return access;
  if (auditLog) auditLog.organizationId = access.organizationId;

  let change: Awaited<ReturnType<typeof updateContactDirectory>>;
  try {
    change = await updateContactDirectory({
      organizationId: access.organizationId,
      directoryId,
      name: body.name,
      workspaceIds: body.workspaceIds,
    });
  } catch (error) {
    return toProblem(error, context.requestId, context.instance);
  }

  if (auditLog) {
    auditLog.oldObject = change.previous;
    auditLog.newObject = change.next;
  }

  const directory = await getContactDirectory(access.organizationId, directoryId);
  if (!directory) return problemForbidden(context.requestId, undefined, context.instance);

  return successResponse(directory, { requestId: context.requestId });
}
