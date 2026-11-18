import { z } from "zod";

export const ZTtlMs = z.int().min(1000, "TTL must be at least 1000ms (1 second)");

export const ZTtlMsOptional = z.int().min(1000, "TTL must be at least 1000ms (1 second)").optional();
