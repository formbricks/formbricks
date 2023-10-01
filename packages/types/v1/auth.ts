import { z } from "zod";
import { ZProfile } from "./profile";

const ZAuthSession = z.object({
  user: ZProfile,
});

const ZAuthenticationApiKey = z.object({
  type: z.literal("apiKey"),
  environmentId: z.string(),
});

export type TAuthSession = z.infer<typeof ZAuthSession>;
export type TAuthenticationApiKey = z.infer<typeof ZAuthenticationApiKey>;
