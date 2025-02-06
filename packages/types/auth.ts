import { z } from "zod";
import { ZUser } from "./user";

export const ZAuthSession = z.object({
  user: ZUser,
});

export const ZAuthenticationApiKey = z.object({
  type: z.literal("apiKey"),
  environmentId: z.string(),
  hashedApiKey: z.string(),
});

export type TAuthSession = z.infer<typeof ZAuthSession>;
export type TAuthenticationApiKey = z.infer<typeof ZAuthenticationApiKey>;
