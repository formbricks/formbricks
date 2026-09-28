import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// ENG-3282, contract §7: survey visibility is about who *manages and reads* a survey inside the app. It
// never changes whether respondents can take one — a private survey keeps collecting responses through
// its link, the SDK and the client API, and its OG image still renders. These surfaces must therefore
// not consult the visibility layer at all. A direct import is the tell that one started to.

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..", "..", "..");

const PUBLIC_SURFACES = [
  "app/api/v1/client", // SDK, displays, response POST, OG image
  "app/api/v2/client",
  "app/s", // the public link survey
  "modules/survey/link",
];

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });

describe("public survey paths stay outside survey visibility", () => {
  test.each(PUBLIC_SURFACES)("%s imports nothing from lib/survey/visibility", (surface) => {
    const files = sourceFiles(path.join(webRoot, surface));
    expect(files.length).toBeGreaterThan(0);

    const offenders = files
      .filter((file) => /["']@\/lib\/survey\/visibility(\/|["'])/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(webRoot, file));
    expect(offenders).toEqual([]);
  });
});
