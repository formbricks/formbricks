import { describe, expect, test } from "vitest";
import { loadLocaleMessages } from "./load-locale-messages";

describe("loadLocaleMessages", () => {
  test("loads the requested locale's catalogue", async () => {
    const messages = (await loadLocaleMessages("de-DE")) as { common: { language: string } };

    expect(messages.common.language).toBe("Sprache");
  });

  // `use()` suspends again on every new promise, so a fresh one per render would never settle.
  test("returns the same promise for the same locale", () => {
    expect(loadLocaleMessages("fr-FR")).toBe(loadLocaleMessages("fr-FR"));
  });

  test("retries a locale whose load failed", async () => {
    const failed = loadLocaleMessages("xx-XX");
    await expect(failed).rejects.toThrow();

    expect(loadLocaleMessages("xx-XX")).not.toBe(failed);
    await expect(loadLocaleMessages("xx-XX")).rejects.toThrow();
  });
});
