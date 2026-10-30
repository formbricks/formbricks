// Pure helpers behind refresh.mjs: parsing the upstream lists, the guards that decide whether a
// refresh may land, and the summary the refresh PR carries. No I/O here, so every rule is testable
// against fixtures (lib.test.ts).

/**
 * Longest domain, in labels, that may enter a list. The sign-up gate walks an address's parent
 * domains up to the longest entry it holds, so one junk entry (upstream carries a 72-label fake
 * reverse-DNS name) would otherwise set that bound for every lookup.
 */
export const MAX_DOMAIN_LABELS = 6;

/** mailservices.json categories we block, i.e. today's policy: personal mailboxes, ISP mailboxes, aliases. */
export const BLOCKED_SERVICE_TYPES = new Set(["mailbox", "isp", "forwarding"]);
const KNOWN_SERVICE_TYPES = new Set([...BLOCKED_SERVICE_TYPES, "hosting", "reserved"]);
const KNOWN_SERVICE_COSTS = new Set(["free", "paid", "freemium"]);

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

/** Lowercases, trims and strips trailing dots; null for anything that is not an ASCII hostname. */
export function normalizeDomain(raw) {
  if (typeof raw !== "string") return null;
  let domain = raw.trim().toLowerCase();
  while (domain.endsWith(".")) domain = domain.slice(0, -1);
  return HOSTNAME.test(domain) ? domain : null;
}

/** One domain per line; blank lines and `#` comments are skipped. */
export function parseLineList(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

/**
 * Builds an "is this domain itself a public suffix?" predicate from the Public Suffix List, ICANN
 * and private sections alike: a private entry such as `ddns.net` hands out subdomains to strangers
 * just as `co.uk` does, so blocking it with subdomain matching would block all of them.
 */
export function parsePublicSuffixList(text) {
  const rules = new Set();
  const wildcards = new Set();
  const exceptions = new Set();
  for (const line of parseLineList(text)) {
    if (line.startsWith("//")) continue;
    const rule = new URL(`http://${line.replace(/^[!*.]+/, "")}`).hostname;
    if (line.startsWith("!")) exceptions.add(rule);
    else if (line.startsWith("*.")) wildcards.add(rule);
    else rules.add(rule);
  }
  if (rules.size === 0) throw new Error("Public Suffix List is empty.");
  return (domain) => {
    if (exceptions.has(domain)) return false;
    if (rules.has(domain)) return true;
    const dot = domain.indexOf(".");
    return dot !== -1 && wildcards.has(domain.slice(dot + 1));
  };
}

const isMap = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Domains of the providers we block from disposable/static-disposable-lists' mailservices.json.
 * Validates the fields we read and fails on any value we do not know: upstream reshaped this file
 * on 2026-10-18 (`type` split into `type` + `costs`), and a silent reinterpretation could block or
 * unblock whole provider categories.
 */
export function extractFreeProviderDomains(json) {
  if (!isMap(json) || Object.keys(json).length === 0) {
    throw new Error("mailservices.json: expected a non-empty object of providers.");
  }
  const domains = [];
  for (const [key, service] of Object.entries(json)) {
    if (!isMap(service)) throw new Error(`mailservices.json: ${key} is not an object.`);
    if (!KNOWN_SERVICE_TYPES.has(service.type)) {
      throw new Error(`mailservices.json: ${key} has unknown type ${JSON.stringify(service.type)}.`);
    }
    if (service.costs !== undefined && !KNOWN_SERVICE_COSTS.has(service.costs)) {
      throw new Error(`mailservices.json: ${key} has unknown costs ${JSON.stringify(service.costs)}.`);
    }
    const hosts = service.hosts ?? [key];
    if (!Array.isArray(hosts) || hosts.some((host) => typeof host !== "string")) {
      throw new Error(`mailservices.json: ${key} has a malformed hosts list.`);
    }
    if (service.discontinued === true || !BLOCKED_SERVICE_TYPES.has(service.type)) continue;
    domains.push(...hosts);
  }
  return domains;
}

/**
 * Normalizes, de-duplicates and sorts upstream domains, dropping what must not reach the gate:
 * malformed names, public suffixes (subdomain matching would block a whole namespace) and names
 * over {@link MAX_DOMAIN_LABELS}. Upstream carries such entries permanently, so they are reported,
 * not fatal.
 */
export function buildDomainList(rawDomains, isPublicSuffix) {
  const kept = new Set();
  const dropped = { invalid: new Set(), publicSuffix: new Set(), tooLong: new Set() };
  for (const raw of rawDomains) {
    const domain = normalizeDomain(raw);
    if (!domain) dropped.invalid.add(String(raw).trim());
    else if (isPublicSuffix(domain)) dropped.publicSuffix.add(domain);
    else if (domain.split(".").length > MAX_DOMAIN_LABELS) dropped.tooLong.add(domain);
    else kept.add(domain);
  }
  const sorted = (set) => [...set].sort();
  return {
    domains: sorted(kept),
    dropped: {
      invalid: sorted(dropped.invalid),
      publicSuffix: sorted(dropped.publicSuffix),
      tooLong: sorted(dropped.tooLong),
    },
  };
}

/** Error when a source lost more than `maxRemovedRatio` of its entries since the last refresh. */
export function checkShrink({ name, previousCount, nextCount, maxRemovedRatio }) {
  if (nextCount === 0) return `${name}: upstream returned no domains.`;
  if (!previousCount) return null;
  const removedRatio = (previousCount - nextCount) / previousCount;
  if (removedRatio <= maxRemovedRatio) return null;
  return `${name}: ${previousCount} → ${nextCount} domains (−${Math.round(removedRatio * 100)}%, limit ${Math.round(maxRemovedRatio * 100)}%). Upstream wipe or poisoning? Review it by hand.`;
}

/**
 * Validates our hand-kept lists. Unlike upstream, every problem here is fatal: these are ours to
 * fix, and a public suffix or contradiction in them changes who can sign up.
 */
export function checkOverrides({ allowed, blocked, isPublicSuffix }) {
  const errors = [];
  const seen = new Map();
  for (const [listName, entries] of [
    ["allowed-domains.json", allowed],
    ["blocked-domains.json", blocked],
  ]) {
    if (!Array.isArray(entries)) {
      errors.push(`${listName}: expected an array of { domain, reason } entries.`);
      continue;
    }
    const inList = new Set();
    for (const entry of entries) {
      const domain = normalizeDomain(entry?.domain);
      if (!domain || domain !== entry.domain) {
        errors.push(`${listName}: ${JSON.stringify(entry?.domain)} is not a lowercase hostname.`);
        continue;
      }
      if (typeof entry.reason !== "string" || !entry.reason.trim()) {
        errors.push(`${listName}: ${domain} needs a reason.`);
      }
      if (isPublicSuffix(domain)) errors.push(`${listName}: ${domain} is a public suffix.`);
      if (domain.split(".").length > MAX_DOMAIN_LABELS) {
        errors.push(`${listName}: ${domain} has more than ${MAX_DOMAIN_LABELS} labels.`);
      }
      if (inList.has(domain)) errors.push(`${listName}: ${domain} is listed twice.`);
      inList.add(domain);
      const other = seen.get(domain);
      if (other && other !== listName) {
        errors.push(`${domain} is in both allowed-domains.json and blocked-domains.json.`);
      }
      seen.set(domain, listName);
    }
  }
  return errors;
}

/** Same parent-domain walk as the sign-up gate: the domain itself, then each parent. */
export function findMatch(domain, set) {
  let candidate = domain;
  while (candidate) {
    if (set.has(candidate)) return candidate;
    const dot = candidate.indexOf(".");
    candidate = dot === -1 ? "" : candidate.slice(dot + 1);
  }
  return null;
}

function diff(previous, next) {
  const before = new Set(previous);
  const after = new Set(next);
  return {
    added: next.filter((domain) => !before.has(domain)),
    removed: previous.filter((domain) => !after.has(domain)),
  };
}

const sample = (domains, limit) =>
  domains.length === 0
    ? "none"
    : domains
        .slice(0, limit)
        .map((domain) => `\`${domain}\``)
        .join(", ") + (domains.length > limit ? `, … (+${domains.length - limit})` : "");

/** Markdown body for the refresh PR: what changed, and what a reviewer should act on. */
export function summarize({ previous, next, sources, dropped, allowed, blocked }) {
  const lists = [
    ["Free / personal providers", "free"],
    ["Disposable", "disposable"],
  ];
  const lines = [
    "## What changed",
    "",
    "| List | Before | After | Added | Removed |",
    "| --- | --- | --- | --- | --- |",
  ];
  const changes = {};
  for (const [label, key] of lists) {
    changes[key] = diff(previous[key], next[key]);
    lines.push(
      `| ${label} | ${previous[key].length} | ${next[key].length} | ${changes[key].added.length} | ${changes[key].removed.length} |`
    );
  }
  lines.push(
    "",
    `**Free providers added:** ${sample(changes.free.added, 60)}`,
    "",
    `**Free providers removed:** ${sample(changes.free.removed, 60)}`,
    "",
    `**Disposable added (sample):** ${sample(changes.disposable.added, 20)}`,
    "",
    `**Disposable removed (sample):** ${sample(changes.disposable.removed, 20)}`,
    "",
    "## Act on",
    ""
  );

  const upstream = new Set([...next.free, ...next.disposable]);
  const coveredBlocks = blocked.map((entry) => entry.domain).filter((domain) => findMatch(domain, upstream));
  const overriddenAllows = allowed
    .map((entry) => entry.domain)
    .filter((domain) => findMatch(domain, upstream));
  lines.push(
    `- **Local blocks now covered upstream** (delete them from \`blocked-domains.json\`): ${sample(coveredBlocks, 50)}`,
    `- **Allowlisted domains that upstream now blocks** (still allowed; check the reason still holds): ${sample(overriddenAllows, 50)}`,
    `- **Upstream entries dropped** — public suffixes: ${sample(dropped.publicSuffix, 40)}; over ${MAX_DOMAIN_LABELS} labels: ${dropped.tooLong.length}; malformed: ${dropped.invalid.length}`,
    "",
    "## Sources",
    "",
    "| Source | Commit | Domains |",
    "| --- | --- | --- |",
    ...sources.map(
      (source) =>
        `| [\`${source.repo}/${source.path}\`](https://github.com/${source.repo}/blob/${source.commit}/${source.path}) | \`${source.commit.slice(0, 10)}\` | ${source.count ?? "—"} |`
    )
  );
  return `${lines.join("\n")}\n`;
}
