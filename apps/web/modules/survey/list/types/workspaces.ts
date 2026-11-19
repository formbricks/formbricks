import { Workspace } from "@formbricks/database/prisma";

export type TUserWorkspace = Pick<Workspace, "id" | "name">;
