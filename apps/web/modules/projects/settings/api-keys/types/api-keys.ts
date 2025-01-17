import { ApiKey } from "@prisma/client";
import { z } from "zod";
import { ZApiKey } from "@formbricks/database/zod/api-keys";

export const ZApiKeyCreateInput = ZApiKey.required({
  label: true,
}).pick({
  label: true,
});

export type TApiKeyCreateInput = z.infer<typeof ZApiKeyCreateInput>;

export interface TApiKey extends ApiKey {
  apiKey?: string;
}
