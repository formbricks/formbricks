import type { TActionClass } from "@formbricks/types/action-classes";

/**
 * Public v3 action-class shape. Exposes only what a client needs to reference an action class from an
 * app-survey trigger (`actionClassId`) and disambiguate it; internal fields (`noCodeConfig`,
 * `workspaceId`, timestamps) stay out of the contract.
 */
export type TV3ActionClassResource = {
  id: string;
  name: string;
  description: string | null;
  type: TActionClass["type"];
  key: string | null;
};

export function serializeV3ActionClass(actionClass: TActionClass): TV3ActionClassResource {
  return {
    id: actionClass.id,
    name: actionClass.name,
    description: actionClass.description,
    type: actionClass.type,
    key: actionClass.key,
  };
}
