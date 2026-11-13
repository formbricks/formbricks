import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { isMergeablePath, mergeI18nLock, mergeLocaleJson, run, serializeLocaleJson } from "./i18n-merge.mjs";

describe("mergeLocaleJson", () => {
  test("keeps keys each side added under the same parent, sorted at every level", () => {
    const base = { common: { a: "A" } };
    const ours = { common: { a: "A", ours: "O" }, zeta: { x: "X" } };
    const theirs = { common: { a: "A", theirs: "T" }, alpha: "first" };

    const { merged, conflicts } = mergeLocaleJson(base, ours, theirs);

    expect(conflicts).toEqual([]);
    expect(Object.keys(merged)).toEqual(["alpha", "common", "zeta"]);
    expect(Object.keys(merged.common)).toEqual(["a", "ours", "theirs"]);
  });

  test("takes whichever side changed a value relative to the base", () => {
    const base = { a: "old", b: "old" };
    const { merged, conflicts } = mergeLocaleJson(base, { a: "ours", b: "old" }, { a: "old", b: "theirs" });

    expect(conflicts).toEqual([]);
    expect(merged).toEqual({ a: "ours", b: "theirs" });
  });

  test("drops a key one side removed and the other left alone", () => {
    const { merged, conflicts } = mergeLocaleJson({ a: "1", b: "2" }, { a: "1", b: "2" }, { a: "1" });

    expect(conflicts).toEqual([]);
    expect(merged).toEqual({ a: "1" });
  });

  test("reports a key both sides changed differently, keeping theirs", () => {
    const { merged, conflicts } = mergeLocaleJson(
      { group: { k: "old" } },
      { group: { k: "ours" } },
      { group: { k: "theirs" } }
    );

    expect(conflicts).toEqual(["group.k"]);
    expect(merged).toEqual({ group: { k: "theirs" } });
  });

  test("accepts an identical change on both sides and a key added by both sides", () => {
    const { merged, conflicts } = mergeLocaleJson(
      { a: "old" },
      { a: "same", n: "new" },
      { a: "same", n: "new" }
    );

    expect(conflicts).toEqual([]);
    expect(merged).toEqual({ a: "same", n: "new" });
  });

  test("reports a key added by both sides with different values", () => {
    const { conflicts } = mergeLocaleJson({}, { n: "ours" }, { n: "theirs" });

    expect(conflicts).toEqual(["n"]);
  });

  test("serialises the way the generated files do, keeping non-ASCII text", () => {
    expect(serializeLocaleJson({ b: "ü", a: ["x"] })).toBe('{\n  "b": "ü",\n  "a": [\n    "x"\n  ]\n}\n');
  });
});

describe("mergeI18nLock", () => {
  const lock = (...entries: string[]) => `version: 1\nchecksums:\n  abc:\n${entries.join("\n")}\n`;
  const hash = (digit: string) => digit.repeat(32);

  test("unions the entries both sides added and sorts them by key", () => {
    const base = lock(`    b: ${hash("1")}`);
    const ours = lock(`    b: ${hash("1")}`, `    b_ours: ${hash("2")}`);
    const theirs = lock(`    a: ${hash("3")}`, `    b: ${hash("1")}`);

    const { merged, conflicts } = mergeI18nLock(base, ours, theirs);

    expect(conflicts).toEqual([]);
    expect(merged).toBe(lock(`    a: ${hash("3")}`, `    b: ${hash("1")}`, `    b_ours: ${hash("2")}`));
  });

  test("sorts by key alone, not by the whole line", () => {
    const { merged } = mergeI18nLock(lock(), lock(`    b_x: ${hash("1")}`), lock(`    b: ${hash("2")}`));

    expect(merged).toBe(lock(`    b: ${hash("2")}`, `    b_x: ${hash("1")}`));
  });

  test("honours a removal and reports a hash both sides changed", () => {
    const base = lock(`    gone: ${hash("1")}`, `    both: ${hash("1")}`);
    const ours = lock(`    gone: ${hash("1")}`, `    both: ${hash("2")}`);
    const theirs = lock(`    both: ${hash("3")}`);

    const { merged, conflicts } = mergeI18nLock(base, ours, theirs);

    expect(conflicts).toEqual(["both"]);
    expect(merged).toBe(lock(`    both: ${hash("3")}`));
  });
});

describe("isMergeablePath", () => {
  test.each([
    "apps/web/locales/de-DE.json",
    "apps/web/locales/en-US.json",
    "apps/web/i18n.lock",
    "packages/surveys/locales/de-DE.json",
    "packages/surveys/i18n.lock",
  ])("resolves %s", (path) => {
    expect(isMergeablePath(path)).toBe(true);
  });

  test.each(["apps/web/package.json", "apps/web/locales/nested/de-DE.json", "docs/i18n.lock"])(
    "leaves %s to a person",
    (path) => {
      expect(isMergeablePath(path)).toBe(false);
    }
  );
});

describe("run on a conflicted git merge", () => {
  const directories: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.com", ...args], {
      cwd,
      encoding: "utf8",
    });

  const write = (cwd: string, path: string, value: unknown) =>
    writeFileSync(join(cwd, path), typeof value === "string" ? value : serializeLocaleJson(value));

  // A repo whose branch and main each append a key to the same locale file and lock.
  const conflictedRepo = (featureKeys: Record<string, string>, mainKeys: Record<string, string>) => {
    const cwd = mkdtempSync(join(tmpdir(), "i18n-merge-"));
    directories.push(cwd);
    git(cwd, "init", "-q", "-b", "main");
    mkdirSync(join(cwd, "apps/web/locales"), { recursive: true });
    const lock = (key: string, hash: string) =>
      `version: 1\nchecksums:\n  abc:\n    a: ${"1".repeat(32)}\n    ${key}: ${hash.repeat(32)}\n`;
    write(cwd, "apps/web/locales/de-DE.json", { a: "A", z: "Z" });
    write(cwd, "apps/web/i18n.lock", lock("z", "9"));
    git(cwd, "add", ".");
    git(cwd, "commit", "-q", "-m", "base");

    git(cwd, "checkout", "-q", "-b", "feature");
    write(cwd, "apps/web/locales/de-DE.json", { a: "A", z: "Z", ...featureKeys });
    write(cwd, "apps/web/i18n.lock", lock("feature", "2"));
    git(cwd, "commit", "-qam", "feature");

    git(cwd, "checkout", "-q", "main");
    write(cwd, "apps/web/locales/de-DE.json", { a: "A", z: "Z", ...mainKeys });
    write(cwd, "apps/web/i18n.lock", lock("main", "3"));
    git(cwd, "commit", "-qam", "main");

    git(cwd, "checkout", "-q", "feature");
    expect(() => git(cwd, "merge", "main")).toThrow();
    return cwd;
  };

  test("resolves and stages the locale and lock, exiting 0", () => {
    const cwd = conflictedRepo({ feature: "F" }, { main: "M" });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(run(cwd)).toBe(0);

    expect(git(cwd, "ls-files", "-u")).toBe("");
    expect(JSON.parse(readFileSync(join(cwd, "apps/web/locales/de-DE.json"), "utf8"))).toEqual({
      a: "A",
      feature: "F",
      main: "M",
      z: "Z",
    });
    expect(readFileSync(join(cwd, "apps/web/i18n.lock"), "utf8")).toContain(`    feature: ${"2".repeat(32)}`);
    expect(readFileSync(join(cwd, "apps/web/i18n.lock"), "utf8")).toContain(`    main: ${"3".repeat(32)}`);
  });

  test("leaves a true conflict unstaged with main's value, exiting 1", () => {
    const cwd = conflictedRepo({ shared: "ours" }, { shared: "theirs" });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(run(cwd)).toBe(1);

    expect(git(cwd, "ls-files", "-u")).toContain("apps/web/locales/de-DE.json");
    expect(JSON.parse(readFileSync(join(cwd, "apps/web/locales/de-DE.json"), "utf8")).shared).toBe("theirs");
    expect(log).toHaveBeenCalledWith("    shared");
  });

  test("reports nothing to do when no locale file is unmerged", () => {
    const cwd = mkdtempSync(join(tmpdir(), "i18n-merge-"));
    directories.push(cwd);
    git(cwd, "init", "-q", "-b", "main");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(run(cwd)).toBe(0);
    expect(log).toHaveBeenCalledWith("No unmerged locale files or i18n.lock to resolve.");
  });
});
