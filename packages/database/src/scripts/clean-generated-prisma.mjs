import { rm } from "node:fs/promises";

await rm("generated/prisma", { recursive: true, force: true });
