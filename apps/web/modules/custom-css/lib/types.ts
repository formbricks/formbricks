import type { Workspace } from "@formbricks/database/prisma-browser";

/**
 * A workspace row without its Custom CSS columns (source, compiled output and the previous revision, up
 * to ~400 KB). The general workspace getters omit them so they never reach the browser; Custom CSS is
 * read through `getWorkspaceCustomCssRecord` instead (ENG-2949).
 */
export type TWorkspaceWithoutCustomCss = Omit<Workspace, "customCss" | "customCssPrevious">;
