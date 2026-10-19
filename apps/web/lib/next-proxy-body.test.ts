import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Guards patches/next@16.3.8.patch (ENG-3972). For every non-GET request the proxy matches, and for every
// external rewrite (the PostHog /ingest proxy), an unpatched Next clones the body: it reads the whole upload
// off the socket, keeps up to `proxyClientMaxBodySize` in memory, and holds the request until the client's
// last byte, so any anonymous caller can pin 16 MB per connection on any path. The patch hands the proxy no
// body at all, and lets a rewrite stream the request to its target instead.
//
// Two things keep that safe, and each half is checked below: the installed Next really is patched (a
// `pnpm install` that skipped the patch, or a Next upgrade that dropped it, would quietly restore the
// clone), and proxy.ts never reads the body it is no longer given.

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** The `body` that `runMiddleware` puts on the request it builds for the proxy. */
const readProxyRequestBody = (file: string): string => {
  const source = fs.readFileSync(require.resolve(file), "utf8");
  const start = source.indexOf("async runMiddleware(params)");
  if (start === -1) throw new Error(`runMiddleware not found in ${file}`);

  const body = /^\s*body: (.+),$/m.exec(source.slice(start));
  if (!body) throw new Error(`runMiddleware builds no request body in ${file}`);
  return body[1];
};

describe("Next proxy request body (patches/next@16.3.8.patch)", () => {
  test.each(["next/dist/server/next-server.js", "next/dist/esm/server/next-server.js"])(
    "%s hands the proxy no body to clone",
    (file) => {
      expect(readProxyRequestBody(file)).toBe("undefined");
    }
  );

  test.each(["next/dist/server/lib/router-server.js", "next/dist/esm/server/lib/router-server.js"])(
    "%s streams an external rewrite's body instead of cloning it",
    (file) => {
      const source = fs.readFileSync(require.resolve(file), "utf8");
      const rewrite =
        /^\s*return await .*proxyRequest\)?\(req, res, parsedUrl, undefined, (.+), config\.experimental\.proxyTimeout\);$/m.exec(
          source
        );
      if (!rewrite) throw new Error(`the external-rewrite proxyRequest call was not found in ${file}`);
      expect(rewrite[1]).toBe("undefined");
      expect(source).not.toContain("cloneBodyStream()");
    }
  );

  test("proxy.ts never reads the request body", () => {
    const source = fs
      .readFileSync(path.resolve(here, "..", "proxy.ts"), "utf8")
      .replaceAll(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

    expect(source).toMatch(/\boriginalRequest\b/);
    expect(source).not.toMatch(
      /\b(?:originalRequest|request)\s*\.\s*(?:body|bodyUsed|json|text|formData|arrayBuffer|blob|bytes|clone)\b/
    );
  });
});
