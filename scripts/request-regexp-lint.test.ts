import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * `formbricks/no-request-regexp` (ENG-7450, ENG-7109's class): a regular expression compiled from
 * request input. It follows a value inside one file; a rule that fires on safe code gets disabled, so the
 * safe shapes below matter as much as the banned ones. The rule sits in `base.mjs`, which every tier
 * shares, so one workspace (apps/web, the `next` tier) is enough.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const RULE = "formbricks/no-request-regexp";

// Each reports `RULE` once.
const banned: Record<string, string> = {
  "action.ts": `declare const actionClient: any;
export const matchAction = actionClient.action(async ({ parsedInput }: any) =>
  new RegExp(parsedInput.pattern).test(parsedInput.value)
);
`,
  // A length cap is not ReDoS protection.
  "request-input-length-cap.ts": `export const validate = async ({ parsedInput: { params } }: any) => {
  const pattern: string = params.pattern;
  if (pattern.length > 512) return false;
  const matcher = new RegExp(pattern, params.flags);
  return matcher.test(params.value);
};
`,
  "template.ts": `export const handler = ({ parsedInput }: any) => {
  const { query } = parsedInput;
  return new RegExp(\`^\${query.filter.trim()}\`, "i");
};
`,
  "request-json.ts": `export async function POST(req: Request) {
  const body = await req.json();
  return Response.json({ ok: RegExp(body.pattern).test("x") });
}
`,
  "context-request-json.ts": `export async function POST(ctx: { req: Request }) {
  const { pattern } = await ctx.req.json();
  return new RegExp(pattern).test("x");
}
`,
  "search-params.ts": `export function GET(request: { nextUrl: URL }) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  return new RegExp(q.toLowerCase()).test("x");
}
`,
  "page-search-params.ts": `export default async function Page({ searchParams }: { searchParams: Promise<{ q: string }> }) {
  const { q } = await searchParams;
  return new RegExp(q).test("x");
}
`,
  "loop.ts": `export const run = ({ parsedInput }: any) => {
  for (const rule of parsedInput.rules) {
    const compiled = new RegExp(rule.pattern);
    if (!compiled.test(rule.value)) return false;
  }
  return true;
};
`,
  "callback.ts": `export const run = ({ parsedInput }: any) =>
  parsedInput.filters.map((filter: any) => new RegExp(filter.value));
`,
  "named-action-handler.ts": `declare const actionClient: any;
const handler = async (args: any) => {
  const { pattern } = args.parsedInput;
  return new RegExp(pattern).test("x");
};
export const matchAction = actionClient.action(handler);
`,
  // The helper is declared after its caller, and gets the tainted value as a plain parameter.
  "same-file-helper.ts": `export async function POST(req: Request) {
  const body = await req.json();
  return compile(body.pattern).test("x");
}
const compile = (pattern: string) => new RegExp(pattern, "i");
`,
  "named-callback.ts": `const compile = (pattern: string) => new RegExp(pattern);
export const run = ({ parsedInput }: any) => parsedInput.patterns.map(compile);
`,
  // \`var\` belongs to the function, so the block does not end it.
  "var-in-block.ts": `export async function POST(req: Request) {
  if (req.method === "POST") {
    var body = await req.json();
  }
  return new RegExp(body.pattern).test("x");
}
`,
  "string-match.ts": `export const run = ({ parsedInput }: any) => "text".match(parsedInput.pattern);
`,
  "string-match-all.ts": `export const run = ({ parsedInput }: any) => [..."text".matchAll(parsedInput.pattern)];
`,
  "string-search.ts": `export const run = ({ parsedInput }: any) => parsedInput.text.search(parsedInput.pattern);
`,
  // A class without every metacharacter leaves the others live.
  "partial-escape.ts": `export const run = ({ parsedInput }: any) =>
  new RegExp(parsedInput.search.replace(/[.]/g, "\\\\$&")).test("x");
`,
  // The class matches no backslash, so \\d stays a live class.
  "escape-without-backslash.ts": `export const run = ({ parsedInput }: any) =>
  new RegExp(parsedInput.search.replace(/[.*+?^\${}()|[\\]]/g, "\\\\$&")).test("x");
`,
  // Two classes joined by "|": the second escapes nothing it should.
  "escape-two-classes.ts": `export const run = ({ parsedInput }: any) =>
  new RegExp(parsedInput.search.replace(/[d]|[^\\\\^$.*+?()[\\]{}|]/g, "\\\\$&")).test("x");
`,
  // Under the v flag, && intersects the classes, so only ")" is escaped.
  "escape-set-operation.ts": `export const run = ({ parsedInput }: any) =>
  new RegExp(parsedInput.search.replace(/[[\\\\\\^\\$\\.\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|]&&[\\)]]/gv, "\\\\$&")).test("x");
`,
  // The y flag stops at the first character that is not a metacharacter.
  "escape-sticky.ts": `export const run = ({ parsedInput }: any) =>
  new RegExp(parsedInput.search.replace(/[\\\\^$.*+?()[\\]{}|]/gy, "\\\\$&")).test("x");
`,
  // Two call sites pass the value at different depths; the whole-value one still counts.
  "helper-two-call-sites.ts": `export async function POST(req: Request) {
  const body = await req.json();
  use({ p: body.pattern });
  use({ p: { x: body.other } });
}
const use = (input: { p: any }) => new RegExp(input.p).test("x");
`,
};

const allowed: Record<string, string> = {
  "escaped-helper.ts": `declare const escapeRegExp: (value: string) => string;
export const run = ({ parsedInput }: any) => new RegExp(escapeRegExp(parsedInput.search), "gi");
`,
  "escaped-inline.ts": `export const run = ({ parsedInput }: any) => {
  const escaped = parsedInput.search.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
  return new RegExp(escaped, "i").test(parsedInput.text);
};
`,
  "regexp-escape-builtin.ts": `export const run = ({ parsedInput }: any) =>
  new RegExp((RegExp as any).escape(parsedInput.search)).test("x");
`,
  // A two-argument search() is not the String method (a query-key factory, a search client).
  "two-argument-search.ts": `declare const keys: { search: (q: string, page: number) => unknown };
export const run = ({ parsedInput }: any) => keys.search(parsedInput.q, 1);
`,
  "length-only.ts": `export const run = ({ parsedInput }: any) => new RegExp(\`^.{\${parsedInput.name.length}}$\`);
`,
  // Compiling only checks the syntax and runs nothing.
  "syntax-check.ts": `export const isValid = ({ parsedInput }: any) => {
  try {
    new RegExp(parsedInput.pattern);
    return true;
  } catch {
    return false;
  }
};
`,
  "constant.ts": `const ID = "[a-z0-9]+";
export const run = ({ parsedInput }: any) => new RegExp(\`#recall:(\${ID})\`, "g").test(parsedInput.text);
`,
  // The pattern is a literal; only the text comes from the request. \`split\` and \`replace\` take a
  // string as text, not as a pattern.
  "constant-pattern-on-input.ts": `export const run = ({ parsedInput }: any) => [
  parsedInput.text.match(/^[a-z]+$/),
  parsedInput.text.split(parsedInput.separator),
  parsedInput.text.replace(parsedInput.from, "x"),
];
`,
  // A plain parameter is not request input when no caller in the file passes it any.
  "plain-parameter.ts": `export const compile = (pattern: string) => new RegExp(pattern);
export const fixed = () => compile("^[a-z]+$");
`,
  "response-json.ts": `export const load = async (res: Response) => new RegExp((await res.json()).pattern);
`,
  // Parsing a function's first argument is not request input unless it holds \`parsedInput\`.
  "parsed-parameter.ts": `declare const S: { parse: (v: unknown) => any; safeParse: (v: unknown) => any };
export const one = (input: unknown) => new RegExp(S.parse(input).pattern);
export const many = (rows: unknown[]) => rows.map((row) => new RegExp(S.parse(row).pattern));
export function checked(config: unknown) {
  const result = S.safeParse(config);
  return result.success ? new RegExp(result.data.pattern) : null;
}
export const json = (text: string) => new RegExp(JSON.parse(text).pattern);
export const inherited = (o: object) => new RegExp(S.parse(o.constructor).pattern);
`,
  // A catch parameter, or a destructuring assignment, rebinds the name it shares with request input.
  "rebound.ts": `export async function POST(req: Request) {
  let e = await req.json();
  let pattern = e.pattern;
  ({ pattern } = { pattern: "^[a-z]+$" });
  try {
    return new RegExp(pattern).test("x");
  } catch (e) {
    return new RegExp((e as Error).message).test("x");
  }
}
`,
  // \`let\` stays in its block: the outer \`body\` is not request input.
  "let-in-block.ts": `export async function POST(req: Request) {
  const body = { pattern: "^[a-z]+$" };
  {
    const body = await req.json();
    void body;
  }
  return new RegExp(body.pattern).test("x");
}
`,
  "disable-comment.ts": `export const run = ({ parsedInput }: any) =>
  // oxlint-disable-next-line formbricks/no-request-regexp -- fixture: a disable comment with its reason
  new RegExp(parsedInput.pattern).test("x");
`,
};

let results: Record<string, FixtureDiagnostic[]>;
const hits = (file: string) => results[file].filter((diagnostic) => diagnostic.ruleId === RULE);

describe(RULE, () => {
  beforeAll(() => {
    results = lintFixtures(`${root}apps/web`, { ...banned, ...allowed });
  }, 120_000);

  test.each(Object.keys(banned))("reports %s", (file) => {
    expect(hits(file)).toEqual([expect.objectContaining({ severity: "error" })]);
  });

  test.each(Object.keys(allowed))("allows %s", (file) => {
    expect(hits(file)).toEqual([]);
  });
});
