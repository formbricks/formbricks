import { Workspace } from "@formbricks/database/prisma";

export interface TUserWorkspace extends Pick<Workspace, "id" | "name"> {}
