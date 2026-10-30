#!/usr/bin/env node
// Fails when two ADRs in docs/adr share a number. ADRs are cited by number ("ADR 0015") in code
// comments and docs, so a duplicate makes those citations ambiguous. Two branches adding the next
// free number in parallel is how it happens; neither branch sees the other until both merge.
// Runs as part of `pnpm lint` (root package.json).
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ADR_PATTERN = /^(\d{4})-.+\.md$/;

/** Maps each ADR number used by more than one file to those files. */
export const findDuplicateAdrNumbers = (fileNames) => {
  const byNumber = new Map();
  for (const name of fileNames) {
    const number = ADR_PATTERN.exec(name)?.[1];
    if (number) byNumber.set(number, [...(byNumber.get(number) ?? []), name]);
  }
  return new Map([...byNumber].filter(([, names]) => names.length > 1));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const adrDir = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "docs", "adr");
  const duplicates = findDuplicateAdrNumbers(readdirSync(adrDir));
  if (duplicates.size > 0) {
    for (const [number, names] of duplicates) {
      console.error(`ADR ${number} is used by more than one file: ${names.join(", ")}`);
    }
    console.error("Give each ADR the next free number, and update any citation of the renamed one.");
    process.exit(1);
  }
}
