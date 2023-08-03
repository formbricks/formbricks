import z from "zod";
import { ZUserNotificationSettings } from "./users";
import { Role, IdentityProvider, Objective } from "@prisma/client";

export const ZProfileUpdateOutput = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string().nullish(),
  email: z.string(),
  emailVerified: z.date().nullish(),
  password: z.string().nullish(),
  onboardingCompleted: z.boolean(),
  identityProvider: z.nativeEnum(IdentityProvider),
  identityProviderAccountId: z.string().nullish(),
  groupId: z.string().nullish(),
  role: z.nativeEnum(Role).nullish(),
  objective: z.nativeEnum(Objective).nullish(),
  notificationSettings: ZUserNotificationSettings,
});

export type TProfileUpdateOutput = z.infer<typeof ZProfileUpdateOutput>;

export const ZProfile = z.object({
  id: z.string(),
  name: z.string().nullish(),
  email: z.string(),
});

export type TProfile = z.infer<typeof ZProfile>;
