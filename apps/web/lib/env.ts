import { z } from "zod";

// Only validate public environment variables needed by the frontend
const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_FORMBRICKS_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.warn("⚠️ Missing or invalid env vars:", parsed.error.flatten().fieldErrors);
}

export const env = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "",
  NEXT_PUBLIC_FORMBRICKS_URL: process.env.NEXT_PUBLIC_FORMBRICKS_URL || "",
};
