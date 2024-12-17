import { applyMigrations } from "./migration-runner";

applyMigrations().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
