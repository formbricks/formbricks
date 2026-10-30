/**
 * The "(imported)" suffix an import gives the things it creates (ENG-6816, amended by ENG-6850): a new
 * survey is "<name> (imported)", or "<name> (imported N)" with the lowest N not taken; an action class
 * whose name the workspace already uses gets the same treatment. A trailing suffix is stripped first,
 * so importing an imported survey again gives "(imported 2)", never "(imported) (imported)".
 *
 * The suffix is translated (`common.imported_suffix`, `common.imported_suffix_number`), so the
 * caller passes its `t`. Pure: the caller reads the names already taken.
 */

type TTranslate = (key: string, options?: Record<string, unknown>) => string;

/** Stands in for the number while the numbered suffix is turned into a pattern. */
const NUMBER_MARK = "\u0000";

const escapeRegExp = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const suffix = (t: TTranslate, number: number): string =>
  number === 1 ? t("common.imported_suffix") : t("common.imported_suffix_number", { number: String(number) });

/** A trailing "(imported)" or "(imported N)", in the user's language, with the space before it. */
const trailingSuffixPattern = (t: TTranslate): RegExp => {
  const plain = escapeRegExp(t("common.imported_suffix"));
  const [before = "", after = ""] = t("common.imported_suffix_number", { number: NUMBER_MARK })
    .split(NUMBER_MARK)
    .map(escapeRegExp);
  return new RegExp(String.raw`\s*(?:${plain}|${before}\d+${after})$`, "u");
};

/** The name without a trailing "(imported N)", so suffixes never stack. */
export const stripImportedSuffix = (name: string, t: TTranslate): string => {
  const stripped = name.replace(trailingSuffixPattern(t), "").trim();
  return stripped === "" ? name.trim() : stripped;
};

/**
 * The first free name for something imported as `name`. With `keepPlainName`, the name as it is comes
 * first, for an action class that only needs a suffix when its name is taken; a survey always gets one.
 *
 * @param isTaken Whether a candidate is already used where the import creates it.
 */
export const getImportedName = (
  name: string,
  isTaken: (candidate: string) => boolean,
  t: TTranslate,
  { keepPlainName = false }: { keepPlainName?: boolean } = {}
): string => {
  const base = stripImportedSuffix(name, t);
  if (keepPlainName && !isTaken(name)) return name;

  // Terminates: every number tried is a different name, and only finitely many are taken.
  for (let number = 1; ; number++) {
    const candidate = `${base} ${suffix(t, number)}`;
    if (!isTaken(candidate)) return candidate;
  }
};
