import { Pool } from "pg";
import { describe, expect, test } from "vitest";
import { createPrismaPgAdapter } from "./prisma-adapter";

describe("createPrismaPgAdapter pool ownership", () => {
  test("passes a pg Pool instance recognized by PrismaPg", async () => {
    const { adapter, connectionString } = createPrismaPgAdapter(
      "postgresql://app:secret@database:5432/formbricks?connect_timeout=15"
    );

    const connection = await adapter.connect();

    try {
      const pool = connection.underlyingDriver();

      expect(pool).toBeInstanceOf(Pool);
      expect(pool.options.connectionString).toBe(connectionString);
    } finally {
      await connection.dispose();
    }
  });
});
