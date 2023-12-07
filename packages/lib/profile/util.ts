import { TProfile } from "@formbricks/types/profile";

export const formatProfileDateFields = (profile: TProfile): TProfile => {
  if (typeof profile.createdAt === "string") {
    profile.createdAt = new Date(profile.createdAt);
  }
  if (typeof profile.updatedAt === "string") {
    profile.updatedAt = new Date(profile.updatedAt);
  }
  if (typeof profile.emailVerified === "string") {
    profile.emailVerified = new Date(profile.emailVerified);
  }

  return profile;
};
