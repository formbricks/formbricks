const RELATIVE_DTS_SPECIFIER = /((?:from|import)\s*["'])(\.\.?(?:\/[^\/"'()?#]+)+)((?:[?#][^"'()]*)?)(["'])/g;
const DYNAMIC_IMPORT_DTS_SPECIFIER =
  /(import\(\s*["'])(\.\.?(?:\/[^\/"'()?#]+)+)((?:[?#][^"'()]*)?)(["']\s*\))/g;

const HAS_EXTENSION = /\.[a-z0-9]+$/i;

const toNodeNextSpecifier = (pathPart: string, suffix = ""): string => {
  if (!pathPart || HAS_EXTENSION.test(pathPart)) {
    return `${pathPart}${suffix}`;
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
    .replace(RELATIVE_DTS_SPECIFIER, (_, prefix, pathPart, suffix, quote) => {
      return `${prefix}${toNodeNextSpecifier(pathPart, suffix)}${quote}`;
    })
    .replace(DYNAMIC_IMPORT_DTS_SPECIFIER, (_, prefix, pathPart, suffix, quote) => {
      return `${prefix}${toNodeNextSpecifier(pathPart, suffix)}${quote}`;
    });

  return { filePath, content: rewrittenContent };
};
