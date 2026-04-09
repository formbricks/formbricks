import { Environment, Workspace } from "@prisma/client";

export interface TUserWorkspace extends Pick<Workspace, "id" | "name"> {
  environments: Pick<Environment, "id" | "type">[];
}
