import { Prisma } from "@prisma/client";

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
  twoFactorEnabled: true,
  identityProvider: true,
  notificationSettings: true,
  locale: true,
  lastLoginAt: true,
  isActive: true,
} as const satisfies Prisma.UserSelect;

export type TPublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;
