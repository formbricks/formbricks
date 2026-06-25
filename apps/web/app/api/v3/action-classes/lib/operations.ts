import "server-only";
import { type TV3WorkspaceListParams, listV3WorkspaceResource } from "@/app/api/v3/lib/list-resource";
import { getActionClasses } from "@/lib/actionClass/service";
import { serializeV3ActionClass } from "../serializers";

export function listV3ActionClasses(params: TV3WorkspaceListParams): Promise<Response> {
  return listV3WorkspaceResource({
    ...params,
    resourceName: "action classes",
    fetchAll: getActionClasses,
    serialize: serializeV3ActionClass,
  });
}
