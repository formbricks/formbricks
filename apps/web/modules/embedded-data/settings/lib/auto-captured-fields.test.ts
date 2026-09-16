import { describe, expect, test } from "vitest";
import { RESERVED_FIELD_CATALOG } from "@formbricks/types/embedded-data-resolver";
import { getAutoCapturedFields } from "./auto-captured-fields";

const byName = (name: string) => getAutoCapturedFields().find((field) => field.name === name);

describe("getAutoCapturedFields", () => {
  test("lists exactly the catalog entries a human-facing surface shows", () => {
    expect(getAutoCapturedFields().map((field) => field.name)).toEqual(
      RESERVED_FIELD_CATALOG.filter((entry) => entry.display !== "none").map((entry) => entry.name)
    );
  });

  test("drops the entries the catalog marks as never listed", () => {
    const names = getAutoCapturedFields().map((field) => field.name);
    expect(names).not.toContain("responseId");
    expect(names).not.toContain("finished");
    expect(names).not.toContain("startedAt");
  });

  test("a field the renderer reads itself is available in logic and recall straight away", () => {
    expect(byName("url")).toMatchObject({ availability: "always", dataType: "string" });
    expect(byName("utmSource")).toMatchObject({ availability: "always" });
    expect(byName("viewportWidth")).toMatchObject({ availability: "always", dataType: "number" });
  });

  test("a field only the server can read is available once the response is submitted", () => {
    for (const name of ["country", "browser", "os", "deviceType", "ipAddress"]) {
      expect(byName(name)).toMatchObject({ availability: "afterSubmit" });
    }
  });

  test("carries the catalog's anonymization verdict through unchanged", () => {
    expect(byName("action")?.privacy).toBe("keep");
    expect(byName("country")?.privacy).toBe("drop");
    expect(byName("url")?.privacy).toBe("redactQuery");
  });

  test("labels camelCase catalog names the way a person would write them", () => {
    expect(byName("deviceType")?.label).toBe("Device Type");
    expect(byName("ipAddress")?.label).toBe("Ip Address");
    expect(byName("url")?.label).toBe("Url");
  });
});
