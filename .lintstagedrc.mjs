import path from "node:path";

const ESLINT_BIN = "node_modules/.bin/eslint";

// Groups staged files by their owning app/package directory (e.g. "apps/web",
// "packages/database"), each exactly one level under apps/ or packages/.
function groupByPackage(files) {
  const groups = new Map();
  for (const absFile of files) {
    const rel = path.relative(process.cwd(), absFile).split(path.sep).join("/");
    const match = /^(apps|packages)\/([^/]+)\//.exec(rel);
    if (!match) continue;
    const pkgDir = `${match[1]}/${match[2]}`;
    if (!groups.has(pkgDir)) groups.set(pkgDir, []);
    groups.get(pkgDir).push(path.relative(pkgDir, rel));
  }
  return groups;
}

// Lints only the staged files themselves (not the whole package) by cd-ing into
// each touched package and invoking its own eslint.config.mjs directly, so a
// commit only pays for the files it touches and pre-existing violations
// elsewhere in the package can't block it.
function lintStagedFiles(files) {
  const groups = groupByPackage(files);
  return [...groups.entries()].map(([pkgDir, relFiles]) => {
    const eslintBin = path.relative(pkgDir, ESLINT_BIN);
    const quotedFiles = relFiles.map((f) => `"${f}"`).join(" ");
    return `sh -c 'cd "${pkgDir}" && "${eslintBin}" ${quotedFiles}'`;
  });
}

export default {
  "(apps|packages)/**/*.{js,ts,jsx,tsx,mjs}": ["prettier --write", lintStagedFiles],
  "*.json": ["prettier --write"],
  "packages/database/schema.prisma": ["prisma format"],
};
