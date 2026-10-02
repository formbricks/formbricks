import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { type IncomingHttpHeaders, type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

// Drives the real script and the real curl against a local stand-in for GitHub's GraphQL API, so
// the retry behaviour is curl's own rather than a mock's idea of it.

const script = fileURLToPath(new URL("./resolve-latest-release.sh", import.meta.url));
const repository = "formbricks/formbricks";
// A fixed dummy, never the caller's GITHUB_TOKEN: the stub records the header and a failing
// assertion would print it.
const token = "test-token-not-a-secret";

// `hang` accepts the request and never answers, to exercise curl's per-attempt timeout.
type StubResponse = { status: number; body: string } | { hang: true };
type SeenRequest = { method?: string; url?: string; headers: IncomingHttpHeaders; body: string };

let server: Server;
let baseUrl: string;
let queue: StubResponse[] = [];
let seen: SeenRequest[] = [];
let workDir: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      seen.push({ method: request.method, url: request.url, headers: request.headers, body });
      const next = queue.shift() ?? { status: 599, body: "stub queue exhausted" };
      if ("hang" in next) return;
      response.writeHead(next.status, { "content-type": "application/json" });
      response.end(next.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  workDir = mkdtempSync(join(tmpdir(), "resolve-latest-release-"));
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(workDir, { recursive: true, force: true });
});

afterEach(() => {
  server.closeAllConnections();
  queue = [];
  seen = [];
});

const respond = (...responses: StubResponse[]) => {
  queue = responses;
};

const graphql = (payload: unknown): StubResponse => ({ status: 200, body: JSON.stringify(payload) });

const release = (tagName: unknown, isLatest: unknown) =>
  graphql({ data: { repository: { release: { tagName, isLatest } } } });

let runs = 0;

const resolve = async (
  currentTag: string,
  { apiUrl = `${baseUrl}/graphql`, path = process.env.PATH, timeout = "20" } = {}
) => {
  const outputFile = join(workDir, `output-${++runs}`);
  writeFileSync(outputFile, "");

  const child = spawn("bash", [script], {
    env: {
      PATH: path,
      CURRENT_TAG: currentTag,
      GITHUB_TOKEN: token,
      GITHUB_REPOSITORY: repository,
      GITHUB_GRAPHQL_URL: apiUrl,
      GITHUB_OUTPUT: outputFile,
      RELEASE_LOOKUP_RETRIES: "1",
      RELEASE_LOOKUP_TIMEOUT: timeout,
    },
  });
  let log = "";
  child.stdout.on("data", (chunk: Buffer) => (log += chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => (log += chunk.toString()));
  const status = await new Promise<number | null>((done) => child.on("close", done));

  return { status, log, output: readFileSync(outputFile, "utf8") };
};

describe("resolve-latest-release.sh", () => {
  test("promotes the release GitHub marks as latest", async () => {
    respond(release("6.1.0", true));

    const result = await resolve("6.1.0");

    expect(result.status).toBe(0);
    expect(result.output).toBe("is_latest=true\n");
  });

  test("does not promote a release GitHub does not mark as latest", async () => {
    respond(release("5.4.6", false));

    const result = await resolve("5.4.6");

    expect(result.status).toBe(0);
    expect(result.output).toBe("is_latest=false\n");
  });

  test("asks for this release with the job token, passing the tag as a variable", async () => {
    respond(release("6.1.0", true));

    await resolve("6.1.0");

    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe("POST");
    expect(seen[0].url).toBe("/graphql");
    expect(seen[0].headers.authorization).toBe(`Bearer ${token}`);
    const request = JSON.parse(seen[0].body);
    expect(request.variables).toEqual({ owner: "formbricks", name: "formbricks", tag: "6.1.0" });
    expect(request.query).toContain("release(tagName: $tag)");
    expect(request.query).not.toContain("6.1.0");
  });

  test("keeps a hostile tag out of the query text", async () => {
    const tag = '6.1.0") { id } evil: viewer { login } #';
    respond(release(tag, true));

    const result = await resolve(tag);

    expect(result.output).toBe("is_latest=true\n");
    expect(JSON.parse(seen[0].body).variables.tag).toBe(tag);
    expect(JSON.parse(seen[0].body).query).not.toContain("viewer");
  });

  test.each([
    [
      "the repository is not visible",
      graphql({
        data: { repository: null },
        errors: [{ type: "NOT_FOUND", message: "Could not resolve to a Repository" }],
      }),
    ],
    ["the release does not exist", graphql({ data: { repository: { release: null } } })],
    ["a rate limit", graphql({ errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded" }] })],
    [
      "an error beside partial data",
      graphql({
        data: { repository: { release: { tagName: "6.1.0", isLatest: true } } },
        errors: [{ type: "FORBIDDEN", message: "Resource not accessible" }],
      }),
    ],
    ["another release's answer", release("6.0.2", true)],
    ["a missing isLatest", graphql({ data: { repository: { release: { tagName: "6.1.0" } } } })],
    ["a non-boolean isLatest", release("6.1.0", "true")],
    ["a null isLatest", release("6.1.0", null)],
    ["no data", graphql({})],
    ["an array", graphql([{ data: { repository: { release: { tagName: "6.1.0", isLatest: true } } } }])],
    ["a body that is not JSON", { status: 200, body: "<html>unicorn</html>" }],
    ["an empty body", { status: 200, body: "" }],
    // jq reads a body as a stream; a second document must not let the first one through.
    [
      "two JSON documents",
      {
        status: 200,
        body: `${JSON.stringify({ data: { repository: { release: { tagName: "6.1.0", isLatest: true } } } })}{}`,
      },
    ],
  ])("fails instead of deciding on %s", async (_, response) => {
    respond(response);

    const result = await resolve("6.1.0");

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
  });

  test.each([401, 403])("fails on HTTP %i without retrying it", async (status) => {
    respond({ status, body: JSON.stringify({ message: "Bad credentials" }) });

    const result = await resolve("6.1.0");

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
    expect(seen).toHaveLength(1);
    expect(result.log).toContain(`HTTP ${status}: Bad credentials`);
  });

  test.each([429, 500, 502, 503])("fails once HTTP %i outlasts the retries", async (status) => {
    respond({ status, body: "{}" }, { status, body: "{}" });

    const result = await resolve("6.1.0");

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
    // One attempt plus RELEASE_LOOKUP_RETRIES=1.
    expect(seen).toHaveLength(2);
  });

  test("decides once a transient failure clears", async () => {
    respond({ status: 503, body: "{}" }, release("6.1.0", true));

    const result = await resolve("6.1.0");

    expect(result.status).toBe(0);
    expect(result.output).toBe("is_latest=true\n");
    // The retry repeats the same authenticated query.
    expect(seen.map((request) => request.headers.authorization)).toEqual(Array(2).fill(`Bearer ${token}`));
    expect(seen[1].body).toBe(seen[0].body);
  });

  test("fails when every attempt times out", async () => {
    respond({ hang: true }, { hang: true });

    const result = await resolve("6.1.0", { timeout: "1" });

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
    expect(seen).toHaveLength(2);
    expect(result.log).toContain("curl exit 28");
  });

  test("fails when the API cannot be reached", async () => {
    // A port that was just released has no listener, so the connection is refused.
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const { port } = closed.address() as AddressInfo;
    await new Promise<void>((resolve) => closed.close(() => resolve()));

    const result = await resolve("6.1.0", { apiUrl: `http://127.0.0.1:${port}/graphql` });

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
    expect(result.log).toContain("Could not reach the GitHub API");
  });

  test("never lets a response start a log line, where Actions would parse it", async () => {
    respond(
      { status: 500, body: "::warning::injected\n::add-mask::x" },
      { status: 500, body: "::warning::injected\n::add-mask::x" }
    );
    const raw = await resolve("6.1.0");
    respond(graphql({ errors: [{ message: "boom\n::warning::injected" }] }));
    const message = await resolve("6.1.0");

    for (const result of [raw, message]) {
      expect(result.status).toBe(1);
      expect(result.log.split("\n").filter((line) => /^::(warning|add-mask)::/.test(line))).toEqual([]);
    }
    expect(raw.log).not.toContain("::add-mask::");
  });

  test("keeps the token out of curl's command line", async () => {
    // ps shows every process's argv on the runner, so the token must not be an argument. A wrapper
    // ahead of the real curl on PATH records the arguments it was given.
    const realCurl = execFileSync("bash", ["-c", "command -v curl"], { encoding: "utf8" }).trim();
    const wrapperDir = mkdtempSync(join(workDir, "bin-"));
    const argvFile = join(wrapperDir, "argv");
    writeFileSync(
      join(wrapperDir, "curl"),
      `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > '${argvFile}'\nexec '${realCurl}' "$@"\n`,
      { mode: 0o755 }
    );
    respond(release("6.1.0", true));

    const result = await resolve("6.1.0", { path: `${wrapperDir}:${process.env.PATH}` });

    expect(result.output).toBe("is_latest=true\n");
    expect(seen[0].headers.authorization).toBe(`Bearer ${token}`);
    expect(readFileSync(argvFile, "utf8")).not.toContain(token);
  });
});
