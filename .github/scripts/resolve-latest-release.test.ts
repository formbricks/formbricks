import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { type IncomingHttpHeaders, type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

// Drives the real script and the real curl against a local stand-in for the GitHub API, so the
// retry behaviour is curl's own rather than a mock's idea of it.

const script = fileURLToPath(new URL("./resolve-latest-release.sh", import.meta.url));
const repository = "formbricks/formbricks";
// A fixed dummy, never the caller's GITHUB_TOKEN: the stub records the header and a failing
// assertion would print it.
const token = "test-token-not-a-secret";

type StubResponse = { status: number; body: string };
type SeenRequest = { url: string | undefined; headers: IncomingHttpHeaders };

let server: Server;
let baseUrl: string;
let queue: StubResponse[] = [];
let seen: SeenRequest[] = [];
let workDir: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    seen.push({ url: request.url, headers: request.headers });
    const next = queue.shift() ?? { status: 599, body: "stub queue exhausted" };
    response.writeHead(next.status, { "content-type": "application/json" });
    response.end(next.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  workDir = mkdtempSync(join(tmpdir(), "resolve-latest-release-"));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(workDir, { recursive: true, force: true });
});

afterEach(() => {
  queue = [];
  seen = [];
});

const respond = (...responses: StubResponse[]) => {
  queue = responses;
};

const latest = (tagName: unknown): StubResponse => ({
  status: 200,
  body: JSON.stringify({ tag_name: tagName }),
});

let runs = 0;

const resolve = async (currentTag: string, { apiUrl = baseUrl, path = process.env.PATH } = {}) => {
  const outputFile = join(workDir, `output-${++runs}`);
  writeFileSync(outputFile, "");

  const child = spawn("bash", [script], {
    env: {
      PATH: path,
      CURRENT_TAG: currentTag,
      GITHUB_TOKEN: token,
      GITHUB_REPOSITORY: repository,
      GITHUB_API_URL: apiUrl,
      GITHUB_OUTPUT: outputFile,
      RELEASE_LOOKUP_RETRIES: "1",
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
    respond(latest("6.1.0"));

    const result = await resolve("6.1.0");

    expect(result.status).toBe(0);
    expect(result.output).toBe("is_latest=true\n");
  });

  test("does not promote a release when another one is latest", async () => {
    respond(latest("6.1.0"));

    const result = await resolve("5.4.6");

    expect(result.status).toBe(0);
    expect(result.output).toBe("is_latest=false\n");
  });

  test("asks for this repository's latest release with the job token", async () => {
    respond(latest("6.1.0"));

    await resolve("6.1.0");

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(`/repos/${repository}/releases/latest`);
    expect(seen[0].headers.authorization).toBe(`Bearer ${token}`);
  });

  test("does not promote when GitHub marks no release as latest", async () => {
    respond({ status: 404, body: JSON.stringify({ message: "Not Found" }) });

    const result = await resolve("5.4.6");

    expect(result.status).toBe(0);
    expect(result.output).toBe("is_latest=false\n");
  });

  test.each([
    ["no tag_name", JSON.stringify({})],
    ["a null tag_name", JSON.stringify({ tag_name: null })],
    ["an empty tag_name", JSON.stringify({ tag_name: "" })],
    ["a non-string tag_name", JSON.stringify({ tag_name: 5 })],
    ["a body that is not JSON", "<html>unicorn</html>"],
  ])("fails instead of deciding on a 200 with %s", async (_, body) => {
    respond({ status: 200, body });

    const result = await resolve("5.4.6");

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
  });

  // The old step wrote the API's tag_name into $GITHUB_OUTPUT, where a newline forges a second output.
  test("never lets a tag_name forge a workflow output", async () => {
    respond(latest("5.4.6\nis_latest=true"));

    const result = await resolve("5.4.6");

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
  });

  test("fails on 403 without retrying it", async () => {
    respond({ status: 403, body: JSON.stringify({ message: "Resource not accessible by integration" }) });

    const result = await resolve("5.4.6");

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
    expect(seen).toHaveLength(1);
    expect(result.log).toContain("HTTP 403: Resource not accessible by integration");
  });

  test.each([429, 500, 502, 503])("fails once HTTP %i outlasts the retries", async (status) => {
    respond({ status, body: "{}" }, { status, body: "{}" });

    const result = await resolve("5.4.6");

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
    // One attempt plus RELEASE_LOOKUP_RETRIES=1.
    expect(seen).toHaveLength(2);
  });

  test("decides once a transient failure clears", async () => {
    respond({ status: 503, body: "{}" }, latest("6.1.0"));

    const result = await resolve("6.1.0");

    expect(result.status).toBe(0);
    expect(result.output).toBe("is_latest=true\n");
    expect(seen).toHaveLength(2);
  });

  test("fails when the API cannot be reached", async () => {
    // A port that was just released has no listener, so the connection is refused.
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const { port } = closed.address() as AddressInfo;
    await new Promise<void>((resolve) => closed.close(() => resolve()));

    const result = await resolve("5.4.6", { apiUrl: `http://127.0.0.1:${port}` });

    expect(result.status).toBe(1);
    expect(result.output).toBe("");
    expect(result.log).toContain("Could not reach the GitHub releases API");
  });

  test("never echoes an error body into the log, where Actions would parse it", async () => {
    respond(
      { status: 500, body: "::warning::injected\n::add-mask::x" },
      { status: 500, body: "::warning::injected" }
    );

    const result = await resolve("5.4.6");

    expect(result.status).toBe(1);
    expect(result.log).not.toContain("::warning::");
    expect(result.log).not.toContain("::add-mask::");
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
    respond(latest("6.1.0"));

    const result = await resolve("6.1.0", { path: `${wrapperDir}:${process.env.PATH}` });

    expect(result.output).toBe("is_latest=true\n");
    expect(seen[0].headers.authorization).toBe(`Bearer ${token}`);
    expect(readFileSync(argvFile, "utf8")).not.toContain(token);
  });
});
