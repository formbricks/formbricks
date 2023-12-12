import { z } from "zod";
import { ZUser } from "./user";

const ZAuthSession = z.object({
  user: ZUser,
});

const ZAuthenticationApiKey = z.object({
  type: z.literal("apiKey"),
  environmentId: z.string(),
});

export type TAuthSession = z.infer<typeof ZAuthSession>;
export type TAuthenticationApiKey = z.infer<typeof ZAuthenticationApiKey>;
