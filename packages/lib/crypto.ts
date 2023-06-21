import { createHash } from "crypto";

export const getHash = (key: string): string => createHash("sha256").update(key).digest("hex");
