import { createHash } from "crypto";

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");
