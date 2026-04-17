import { Workspace } from "@prisma/client";

export interface TUserWorkspace extends Pick<Workspace, "id" | "name"> {}
