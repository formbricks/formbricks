import type { MigrationScript } from "../../src/scripts/migration-runner";

export const sunsetWeeklySummary: MigrationScript = {
  type: "data",
  id: "v0ruecekavlfu8410htz4mly",
  name: "20250722075349_sunset_weekly_summary",
  run: async ({ tx }) => {
    // Remove weeklySummary from notificationSettings for all users where it is set
    await tx.$queryRaw`
    UPDATE "User"
    SET "notificationSettings" = "notificationSettings" - 'weeklySummary'
    WHERE "notificationSettings"->>'weeklySummary' IS NOT NULL
    `;
  },
};
