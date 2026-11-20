import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * The two same-function taint rules of the `formbricks` oxlint plugin (ENG-7450), for the classes of
 * ENG-7127 and ENG-7109:
 * - `formbricks/no-loose-schema-prisma-write`: the output of a loose zod schema in a Prisma write's data.
 * - `formbricks/no-request-regexp`: `new RegExp` compiled from request input.
 * Both follow a value inside one file only; a rule that fires on safe code gets disabled, so the safe
 * shapes below matter as much as the banned ones. Linted through the `next` (apps/web) and `library`
 * (packages/types) tiers, which every other tier shares `base.mjs` with.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const workspaces = ["apps/web", "packages/types"];

const LOOSE = "formbricks/no-loose-schema-prisma-write";
const REGEXP = "formbricks/no-request-regexp";

const header = `import { z } from "zod";
import { prisma } from "@formbricks/database";
`;

// Each reports `LOOSE` once.
const looseBanned: Record<string, string> = {
  // ENG-7127's shape: rest destructuring keeps every unknown key, then a spread inside a transaction.
  "loose-rest-spread.ts": `${header}
const ZSurveyDraft = z.looseObject({ id: z.string() });
export const save = async (input: unknown) => {
  const { id, ...rest } = ZSurveyDraft.parse(input);
  await prisma.$transaction(async (tx) =>
    tx.survey.update({ where: { id }, data: { ...rest, updatedAt: new Date() } })
  );
};
`,
  "loose-action-parsed-input.ts": `${header}
declare const actionClient: any;
const ZInput = z.object({ name: z.string() }).loose();
export const createTagAction = actionClient
  .inputSchema(ZInput)
  .action(async ({ parsedInput }: { parsedInput: any }) => prisma.tag.create({ data: parsedInput }));
`,
  "loose-safe-parse.ts": `${header}
const ZInput = z.object({ name: z.string() }).passthrough();
export const update = async (id: string, input: unknown) => {
  const result = ZInput.safeParse(input);
  if (!result.success) return;
  const payload = result.data;
  await prisma.tag.update({ where: { id }, data: payload });
};
`,
  "loose-extended-upsert.ts": `${header}
const ZTagFields = ZBase.extend({ name: z.string() }).nullable();
const ZBase = z.object({}).catchall(z.unknown());
export const upsert = async (id: string, input: unknown) => {
  const tag = ZTagFields.parse(input)!;
  await prisma.tag.upsert({ where: { id }, create: { id, name: "x" }, update: { ...tag } });
};
`,
  "loose-v3-handler.ts": `${header}
declare const withV3ApiWrapper: any;
const ZBody = z.looseObject({ name: z.string() });
export const POST = withV3ApiWrapper({
  schemas: { body: ZBody },
  handler: async ({ parsedInput: { body } }: any) => prisma.tag.create({ data: { ...body } }),
});
`,
  "loose-inline.ts": `${header}
export const save = (id: string, input: unknown) =>
  prisma.tag.update({ where: { id }, data: z.object({ name: z.string() }).loose().parse(input) });
`,
};

const looseAllowed: Record<string, string> = {
  "strict-spread.ts": `${header}
const ZInput = z.object({ name: z.string() });
export const save = (input: unknown) => prisma.tag.create({ data: { ...ZInput.parse(input) } });
`,
  "loose-picked-columns.ts": `${header}
const ZInput = z.looseObject({ name: z.string() });
export const save = (input: unknown) => {
  const parsed = ZInput.parse(input);
  return prisma.tag.create({ data: { name: parsed.name } });
};
`,
  "loose-made-strict.ts": `${header}
const ZLoose = z.looseObject({ name: z.string() });
const ZStrict = ZLoose.strict();
const ZNever = z.object({ name: z.string() }).catchall(z.never());
export const save = (input: unknown) =>
  prisma.tag.create({ data: { ...ZStrict.parse(input), ...ZNever.parse(input) } });
`,
  "loose-transformed.ts": `${header}
const ZInput = z.looseObject({ name: z.string() }).transform(({ name }) => ({ name }));
export const save = (input: unknown) => prisma.tag.create({ data: ZInput.parse(input) });
`,
  "loose-not-written.ts": `${header}
declare const logger: { info: (value: unknown) => void };
const ZInput = z.looseObject({ name: z.string() });
export const log = (input: unknown) => logger.info({ ...ZInput.parse(input) });
export const read = (input: unknown) => prisma.tag.findMany({ where: { ...ZInput.parse(input) } });
`,
  // An inner binding of the same name is another schema.
  "loose-shadowed.ts": `${header}
const schema = z.looseObject({ name: z.string() });
export const save = (input: unknown) => {
  const schema = z.object({ name: z.string() });
  return prisma.tag.create({ data: schema.parse(input) });
};
export const keep = schema;
`,
  "loose-allowlisted.ts": `${header}
const ZInput = z.looseObject({ name: z.string() });
export const save = (input: unknown) =>
  // oxlint-disable-next-line formbricks/no-loose-schema-prisma-write -- fixture: the allowlist
  prisma.tag.create({ data: ZInput.parse(input) });
`,
};

// Each reports `REGEXP` once.
const regexpBanned: Record<string, string> = {
  "regexp-action.ts": `declare const actionClient: any;
export const matchAction = actionClient.action(async ({ parsedInput }: any) =>
  new RegExp(parsedInput.pattern).test(parsedInput.value)
);
`,
  // ENG-7109's shape: a "protected" pattern behind a length cap.
  "regexp-length-cap.ts": `export const validate = async ({ parsedInput: { params } }: any) => {
  const pattern: string = params.pattern;
  if (pattern.length > 512) return false;
  const matcher = new RegExp(pattern, params.flags);
  return matcher.test(params.value);
};
`,
  "regexp-template.ts": `export const handler = ({ parsedInput }: any) => {
  const { query } = parsedInput;
  return new RegExp(\`^\${query.filter.trim()}\`, "i");
};
`,
  "regexp-request-json.ts": `export async function POST(req: Request) {
  const body = await req.json();
  return Response.json({ ok: RegExp(body.pattern).test("x") });
}
`,
  "regexp-search-params.ts": `export function GET(request: { nextUrl: URL }) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  return new RegExp(q.toLowerCase()).test("x");
}
`,
  "regexp-loop.ts": `export const run = ({ parsedInput }: any) => {
  for (const rule of parsedInput.rules) {
    const compiled = new RegExp(rule.pattern);
    if (!compiled.test(rule.value)) return false;
  }
  return true;
};
`,
  "regexp-callback.ts": `export const run = ({ parsedInput }: any) =>
  parsedInput.filters.map((filter: any) => new RegExp(filter.value));
`,
};

const regexpAllowed: Record<string, string> = {
  "regexp-escaped.ts": `declare const escapeRegExp: (value: string) => string;
export const run = ({ parsedInput }: any) => new RegExp(escapeRegExp(parsedInput.search), "gi");
`,
  // Compiling only checks the syntax and runs nothing.
  "regexp-syntax-check.ts": `export const isValid = ({ parsedInput }: any) => {
  try {
    new RegExp(parsedInput.pattern);
    return true;
  } catch {
    return false;
  }
};
`,
  "regexp-constant.ts": `const ID = "[a-z0-9]+";
export const run = ({ parsedInput }: any) => new RegExp(\`#recall:(\${ID})\`, "g").test(parsedInput.text);
`,
  // A plain parameter is not request input, even if a caller passes it one: the rule stays in-function.
  "regexp-plain-parameter.ts": `export const compile = (pattern: string) => new RegExp(pattern);
`,
  "regexp-response-json.ts": `export const load = async (res: Response) => new RegExp((await res.json()).pattern);
`,
  // Parsing a function's first argument is not request input unless it holds \`parsedInput\`.
  "regexp-parsed-parameter.ts": `declare const S: { parse: (v: unknown) => any; safeParse: (v: unknown) => any };
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
  "regexp-rebound.ts": `export async function POST(req: Request) {
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
  "regexp-allowlisted.ts": `export const run = ({ parsedInput }: any) =>
  // oxlint-disable-next-line formbricks/no-request-regexp -- fixture: the allowlist
  new RegExp(parsedInput.pattern).test("x");
`,
};

const results = new Map<string, Record<string, FixtureDiagnostic[]>>();
const hits = (workspace: string, file: string, rule: string) =>
  results.get(workspace)![file].filter((diagnostic) => diagnostic.ruleId === rule);

const cases = (files: Record<string, string>) =>
  workspaces.flatMap((workspace) => Object.keys(files).map((file) => [workspace, file]));

describe("security taint rules", () => {
  beforeAll(() => {
    for (const workspace of workspaces) {
      results.set(
        workspace,
        lintFixtures(`${root}${workspace}`, {
          ...looseBanned,
          ...looseAllowed,
          ...regexpBanned,
          ...regexpAllowed,
        })
      );
    }
  }, 120_000);

  test.each(cases(looseBanned))(`%s: ${LOOSE} reports %s`, (workspace, file) => {
    expect(hits(workspace, file, LOOSE)).toEqual([expect.objectContaining({ severity: "error" })]);
  });

  test.each(cases(looseAllowed))(`%s: ${LOOSE} allows %s`, (workspace, file) => {
    expect(hits(workspace, file, LOOSE)).toEqual([]);
  });

  test.each(cases(regexpBanned))(`%s: ${REGEXP} reports %s`, (workspace, file) => {
    expect(hits(workspace, file, REGEXP)).toEqual([expect.objectContaining({ severity: "error" })]);
  });

  test.each(cases(regexpAllowed))(`%s: ${REGEXP} allows %s`, (workspace, file) => {
    expect(hits(workspace, file, REGEXP)).toEqual([]);
  });
});
