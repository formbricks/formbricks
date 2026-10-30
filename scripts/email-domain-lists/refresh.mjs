#!/usr/bin/env node
// Regenerates the Cloud sign-up blocklists in apps/web/modules/auth/lib/email-domain-lists/ from their
// upstream sources, each fetched at the commit that last touched it, and writes a PR summary.
//
//   node scripts/email-domain-lists/refresh.mjs [--summary <file>]
//
// Exits non-zero, writing nothing, when a guard fails (see lib.mjs). The weekly workflow
// (.github/workflows/refresh-email-domain-lists.yml) opens a PR from whatever this changes; with no
// upstream change it writes byte-identical files, so there is nothing to commit.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_DOMAIN_LABELS,
  buildDomainList,
  checkOverrides,
  checkShrink,
  extractFreeProviderDomains,
  parseLineList,
  parsePublicSuffixList,
  summarize,
} from "./lib.mjs";

const LIST_DIR = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../apps/web/modules/auth/lib/email-domain-lists"
);
const FETCH_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

/**
 * `maxRemovedRatio` is per source. domains_mx.txt is re-derived from live DNS every day, so it
 * legitimately loses thousands of names a month and only a wipe should stop it; the two curated
 * sources should barely ever shrink.
 */
const SOURCES = {
  psl: { repo: "publicsuffix/list", path: "public_suffix_list.dat" },
  disposableMx: {
    repo: "disposable/disposable-email-domains",
    path: "domains_mx.txt",
    maxRemovedRatio: 0.5,
  },
  disposableCurated: {
    repo: "disposable-email-domains/disposable-email-domains",
    path: "disposable_email_blocklist.conf",
    maxRemovedRatio: 0.1,
  },
  mailservices: {
    repo: "disposable/static-disposable-lists",
    path: "mailservices.json",
    maxRemovedRatio: 0.1,
  },
};

async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES)
    throw new Error(`GET ${url}: response over ${MAX_RESPONSE_BYTES} bytes.`);
  return text;
}

/** Pins a source to the latest commit that touched its file, so the PR records exactly what it took. */
async function fetchSource({ repo, path }) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const commits = JSON.parse(
    await fetchText(
      `https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(path)}&per_page=1`,
      headers
    )
  );
  const commit = commits[0]?.sha;
  if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error(`${repo}/${path}: no commit found.`);
  const text = await fetchText(`https://raw.githubusercontent.com/${repo}/${commit}/${path}`);
  return { repo, path, commit, text };
}

const readJson = (name, fallback) => {
  const file = resolve(LIST_DIR, name);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
};
const writeJson = (name, value) =>
  writeFileSync(resolve(LIST_DIR, name), `${JSON.stringify(value, null, 2)}\n`);

async function main() {
  const summaryArg = process.argv.indexOf("--summary");
  const summaryPath = summaryArg === -1 ? null : process.argv[summaryArg + 1];

  const [psl, disposableMx, disposableCurated, mailservices] = await Promise.all(
    [SOURCES.psl, SOURCES.disposableMx, SOURCES.disposableCurated, SOURCES.mailservices].map(fetchSource)
  );
  const isPublicSuffix = parsePublicSuffixList(psl.text);

  const free = buildDomainList(extractFreeProviderDomains(JSON.parse(mailservices.text)), isPublicSuffix);
  const mx = buildDomainList(parseLineList(disposableMx.text), isPublicSuffix);
  const curated = buildDomainList(parseLineList(disposableCurated.text), isPublicSuffix);
  const disposable = [...new Set([...mx.domains, ...curated.domains])].sort();

  const previousSources = readJson("sources.json", { sources: [] }).sources;
  const previousCount = (repo) => previousSources.find((source) => source.repo === repo)?.count;
  const counted = [
    [disposableMx, SOURCES.disposableMx, mx.domains.length],
    [disposableCurated, SOURCES.disposableCurated, curated.domains.length],
    [mailservices, SOURCES.mailservices, free.domains.length],
  ];

  const allowed = readJson("allowed-domains.json", []);
  const blocked = readJson("blocked-domains.json", []);
  const errors = [
    ...counted.map(([source, config, nextCount]) =>
      checkShrink({
        name: `${source.repo}/${source.path}`,
        previousCount: previousCount(source.repo),
        nextCount,
        maxRemovedRatio: config.maxRemovedRatio,
      })
    ),
    ...checkOverrides({ allowed, blocked, isPublicSuffix }),
  ].filter(Boolean);
  if (errors.length > 0) {
    for (const error of errors) console.error(`::error::${error}`);
    process.exit(1);
  }

  const dropped = {};
  for (const reason of ["publicSuffix", "tooLong", "invalid"]) {
    dropped[reason] = [...new Set([free, mx, curated].flatMap((list) => list.dropped[reason]))].sort();
  }
  const sources = [
    { repo: psl.repo, path: psl.path, commit: psl.commit },
    ...counted.map(([source, , count]) => ({
      repo: source.repo,
      path: source.path,
      commit: source.commit,
      count,
    })),
  ];

  const summary = summarize({
    previous: {
      free: readJson("free-provider-domains.json", []),
      disposable: readJson("disposable-domains.json", []),
    },
    next: { free: free.domains, disposable },
    sources,
    dropped,
    allowed,
    blocked,
  });

  writeJson("free-provider-domains.json", free.domains);
  writeJson("disposable-domains.json", disposable);
  writeJson("sources.json", { maxDomainLabels: MAX_DOMAIN_LABELS, sources, dropped });
  if (summaryPath) writeFileSync(summaryPath, summary);
  console.log(summary);
}

await main();
