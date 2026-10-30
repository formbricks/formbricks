import { describe, expect, test } from "vitest";
import enUS from "@/locales/en-US.json";
import { getImportedName, importedNamePrefix, stripImportedSuffix } from "./imported-name";

/** `t` over a locale's two suffix strings, interpolating `{number}` as ICU does for a plain argument. */
const translator =
  (strings: { imported_suffix: string; imported_suffix_number: string }) =>
  (key: string, options?: Record<string, unknown>): string => {
    const template =
      key === "common.imported_suffix" ? strings.imported_suffix : strings.imported_suffix_number;
    return template.replace("{number}", String(options?.number ?? ""));
  };

const t = translator(enUS.common);
const takenIn = (names: string[]) => (candidate: string) => names.includes(candidate);

describe("getImportedName", () => {
  test('names a survey "<name> (imported)" when that is free', () => {
    expect(getImportedName("Onboarding NPS", takenIn([]), t)).toBe("Onboarding NPS (imported)");
  });

  test("takes the lowest free number when the name is taken", () => {
    expect(
      getImportedName(
        "Onboarding NPS",
        takenIn(["Onboarding NPS (imported)", "Onboarding NPS (imported 3)"]),
        t
      )
    ).toBe("Onboarding NPS (imported 2)");
  });

  test("strips a trailing suffix first, so importing an import again never stacks suffixes", () => {
    expect(getImportedName("Onboarding NPS (imported)", takenIn(["Onboarding NPS (imported)"]), t)).toBe(
      "Onboarding NPS (imported 2)"
    );
    expect(getImportedName("Onboarding NPS (imported 4)", takenIn([]), t)).toBe("Onboarding NPS (imported)");
  });

  test("keeps a free plain name when asked to, as an action class does, and suffixes a taken one", () => {
    expect(getImportedName("Checkout", takenIn([]), t, { keepPlainName: true })).toBe("Checkout");
    expect(getImportedName("Checkout", takenIn(["Checkout"]), t, { keepPlainName: true })).toBe(
      "Checkout (imported)"
    );
  });

  test("uses the suffix of the user's language", () => {
    const de = translator({
      imported_suffix: "(importiert)",
      imported_suffix_number: "(importiert {number})",
    });
    expect(getImportedName("Umfrage (importiert 2)", takenIn(["Umfrage (importiert)"]), de)).toBe(
      "Umfrage (importiert 2)"
    );
  });
});

describe("stripImportedSuffix", () => {
  test("leaves a name that is only a suffix, or has one in the middle, as it is", () => {
    expect(stripImportedSuffix("(imported)", t)).toBe("(imported)");
    expect(stripImportedSuffix("A (imported) survey", t)).toBe("A (imported) survey");
  });
});

describe("importedNamePrefix", () => {
  /** The names `getImportedName` tries for `name` before it finds a free one, `count` of them. */
  const candidatesOf = (name: string, translate: typeof t, count: number): string[] => {
    const tried: string[] = [];
    getImportedName(name, (candidate) => tried.push(candidate) < count, translate);
    return tried;
  };

  test("is what every numbered candidate starts with, from the name without its suffix", () => {
    expect(importedNamePrefix("Signup (imported 2)", t)).toBe("Signup (imported");
    for (const name of ["Signup", "Signup (imported)", "Signup (imported 7)", "50%_off"]) {
      const prefix = importedNamePrefix(name, t);
      expect(candidatesOf(name, t, 12).every((candidate) => candidate.startsWith(prefix))).toBe(true);
    }
  });

  test("stops where the plain and the numbered suffix differ, in any language", () => {
    const other = translator({
      imported_suffix: "[import]",
      imported_suffix_number: "[import nr. {number}]",
    });

    expect(importedNamePrefix("Umfrage", other)).toBe("Umfrage [import");
    expect(
      candidatesOf("Umfrage", other, 5).every((candidate) => candidate.startsWith("Umfrage [import"))
    ).toBe(true);
  });
});
