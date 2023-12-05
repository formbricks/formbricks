import { TProfile } from "@formbricks/types/profile";

export const formatProfileDateFields = (profile: TProfile): TProfile => {
  if (typeof profile.createdAt === "string") {
    profile.createdAt = new Date(profile.createdAt);
  }
  if (typeof profile.updatedAt === "string") {
    profile.updatedAt = new Date(profile.updatedAt);
  }

  return profile;
};
