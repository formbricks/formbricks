import { z } from "zod";

/** Input of `get_account_context`. Like list_workspaces, there is nothing to declare: the account is the caller's own. */
export const ZMcpGetAccountContextInput = z.object({}).strict();

export type TMcpGetAccountContextInput = z.infer<typeof ZMcpGetAccountContextInput>;
