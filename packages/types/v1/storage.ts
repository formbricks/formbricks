import { z } from "zod";

export const ZAccessType = z.enum(["public", "private"]);

export const ZFileName = z
  .string()
  .refine(
    (value) => {
      // get the string parts, they should be 3 in length
      const parts = value.split("/");
      if (parts.length !== 3) return false;

      const [environmentId, accessType, fileName] = parts;

      // we'll validate the accessType later
      if (typeof accessType !== "string" || accessType.trim().length === 0) {
        return false;
      }

      if (typeof environmentId !== "string" || environmentId.trim().length === 0) {
        return false;
      }

      if (typeof fileName !== "string" || fileName.trim().length === 0) {
        return false;
      }

      return true;
    },
    {
      message: "The filename does not match the expected format",
    }
  )
  .refine(
    (val) => {
      const [, accessType] = val.split("/");
      return ZAccessType.safeParse(accessType).success;
    },
    {
      message: "Access type must be either 'public' or 'private'",
    }
  );

export type TAccessType = z.infer<typeof ZAccessType>;
