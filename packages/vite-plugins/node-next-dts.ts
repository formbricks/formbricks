const RELATIVE_DTS_SPECIFIER =
  /(?<prefix>(?:from|import)\s*["'])(?<pathPart>\.\.?(?:\/[^/"'()?#]+)+)(?<suffix>(?:[?#][^"'()]*)?)(?<quote>["'])/g;
const DYNAMIC_IMPORT_DTS_SPECIFIER =
  /(?<prefix>import\(\s*["'])(?<pathPart>\.\.?(?:\/[^/"'()?#]+)+)(?<suffix>(?:[?#][^"'()]*)?)(?<quote>["']\s*\))/g;

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
    .replace(
      RELATIVE_DTS_SPECIFIER,
      (_match: string, prefix: string, pathPart: string, suffix: string, quote: string) => {
        return `${prefix}${toNodeNextSpecifier(pathPart, suffix)}${quote}`;
      }
    )
    .replace(
      DYNAMIC_IMPORT_DTS_SPECIFIER,
      (_match: string, prefix: string, pathPart: string, suffix: string, quote: string) => {
        return `${prefix}${toNodeNextSpecifier(pathPart, suffix)}${quote}`;
      }
    );

  return { filePath, content: rewrittenContent };
};
