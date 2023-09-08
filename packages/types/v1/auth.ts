import { z } from "zod";

const StaticImageData = z.object({
  // Placeholder schema for StaticImageData
  // ... (fill in with actual keys and types for the StaticImageData)
});

const ZAuthSession = z.object({
  user: z.object({
    id: z.string(),
    createdAt: z.string(),
    teams: z.array(
      z.object({
        id: z.string(),
        plan: z.string(),
        role: z.string(),
      })
    ),
    email: z.string(),
    name: z.string(),
    onboardingCompleted: z.boolean(),
    image: StaticImageData.optional(),
  }),
});

const ZAuthenticationApiKey = z.object({
  type: z.literal("apiKey"),
  environmentId: z.string(),
});

const ZAuthenticationSession = z.object({
  type: z.literal("session"),
  session: ZAuthSession,
  environmentId: z.string().optional(),
});

const ZAuthentication = z.union([ZAuthenticationApiKey, ZAuthenticationSession]);

export type TAuthSession = z.infer<typeof ZAuthSession>;
export type TAuthenticationApiKey = z.infer<typeof ZAuthenticationApiKey>;
export type TAuthenticationSession = z.infer<typeof ZAuthenticationSession>;
export type TAuthentication = z.infer<typeof ZAuthentication>;
