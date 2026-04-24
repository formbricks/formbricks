const RELATIVE_DTS_SPECIFIER = /((?:from|import)\s*["'])(\.\.?(?:\/[^"'()]+)+)(["'])/g;
const DYNAMIC_IMPORT_DTS_SPECIFIER = /(import\(\s*["'])(\.\.?(?:\/[^"'()]+)+)(["']\s*\))/g;

const HAS_EXTENSION = /\.[a-z0-9]+$/i;

const toNodeNextSpecifier = (specifier: string): string => {
  const [pathPart, suffix = ""] = specifier.split(/([?#].*)/, 2);

  if (!pathPart || HAS_EXTENSION.test(pathPart)) {
    return specifier;
  }

  return `${pathPart}.js${suffix}`;
};

export const rewriteNodeNextDtsSpecifiers = (
  filePath: string,
  content: string
): { filePath: string; content: string } => {
  if (!filePath.endsWith(".d.ts")) {
    return { filePath, content };
  }

  const rewrittenContent = content
    .replace(RELATIVE_DTS_SPECIFIER, (_, prefix, specifier, suffix) => {
      return `${prefix}${toNodeNextSpecifier(specifier)}${suffix}`;
    })
    .replace(DYNAMIC_IMPORT_DTS_SPECIFIER, (_, prefix, specifier, suffix) => {
      return `${prefix}${toNodeNextSpecifier(specifier)}${suffix}`;
    });

  return { filePath, content: rewrittenContent };
};
