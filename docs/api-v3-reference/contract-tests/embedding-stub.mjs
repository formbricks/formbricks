/**
 * A deterministic, offline stand-in for an OpenAI-compatible embeddings API, so the two
 * semantic-search operations in the v3 contract can be exercised in CI.
 *
 * Without an embedding provider the feedback store answers **503** on
 * `GET /api/v3/feedback-records/{feedbackRecordId}/similar` and
 * `POST /api/v3/feedback-records/search/semantic`. That is correct behaviour, and it is also a 5xx,
 * so `not_a_server_error` fails the run — and the two operations would only ever be seen in their
 * degraded state, which is the shallow-green outcome this harness exists to prevent. A real provider
 * is the wrong answer here: it costs money per run, needs a secret fork PRs cannot have, and makes a
 * contract job depend on a third party's uptime.
 *
 * The store reaches this through `EMBEDDING_BASE_URL`, which it accepts only for the `openai`
 * provider (`internal/service/embedding_client_factory.go`), via the official OpenAI SDK — hence the
 * `/v1/embeddings` shape below. The store requires exactly 768 floats back
 * (`models.EmbeddingVectorDimensions`) and rejects any other length, so `dimensions` from the request
 * is honoured and defaults to the same number.
 *
 * Vectors are a bag-of-words projection rather than a hash of the whole string: each token is hashed
 * to a coordinate and accumulated, then the vector is L2-normalised. That makes cosine similarity
 * behave the way the operations assume — texts sharing words score high, unrelated texts score near
 * zero — so a search for seeded text actually returns the seeded records instead of an empty page
 * that would satisfy the schema while proving nothing. It is not semantic: paraphrases with no shared
 * words score low. Fine here, where the subject under test is the contract, not the model.
 *
 * Usage: `node embedding-stub.mjs [port]` (default 8079). Prints its URL once listening.
 *
 * Binds `0.0.0.0` rather than loopback because the store runs in a container and has to reach it: on
 * a bridge network — what `docker-compose.dev.yml` gives you locally — `host.docker.internal` resolves
 * to the host's LAN address, not `127.0.0.1`. A CI runner is ephemeral and a developer machine is
 * not, so run it only while you need it: it authenticates nothing and answers anyone who asks.
 */
import { createServer } from "node:http";

const DIMENSIONS = 768;
const MAX_BODY_BYTES = 1 << 20;

/** FNV-1a, so a token maps to the same coordinate on every run and every machine. */
const hashToken = (token) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
};

const embed = (text, dimensions) => {
  const vector = new Float64Array(dimensions);
  const tokens =
    String(text)
      .toLowerCase()
      .match(/[a-z0-9']+/g) ?? [];

  for (const token of tokens) {
    const hash = hashToken(token);
    // A second, decorrelated bit chooses the sign, so two different tokens landing on one coordinate
    // are as likely to cancel as to reinforce — without it every vector points into one hyperoctant
    // and everything looks similar to everything.
    const sign = (hash >>> 31) & 1 ? -1 : 1;
    vector[hash % dimensions] += sign;
  }

  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);

  // An input with no tokens at all (punctuation, say) would divide by zero. The store rejects empty
  // input before it gets here, so this is only reachable for something like "..." — answer with a
  // fixed unit vector rather than 768 NaNs, which would fail as a confusing DB error much later.
  if (norm === 0) {
    const fallback = new Array(dimensions).fill(0);
    fallback[0] = 1;
    return fallback;
  }

  return Array.from(vector, (value) => value / norm);
};

const server = createServer((req, res) => {
  const reply = (status, payload) => {
    const body = JSON.stringify(payload);
    res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
    res.end(body);
  };

  // The runner's readiness probe, and a way to tell "stub is up" from "stub is wedged".
  if (req.method === "GET" && req.url === "/health") {
    reply(200, { status: "ok", dimensions: DIMENSIONS });
    return;
  }

  if (req.method !== "POST" || !req.url?.endsWith("/embeddings")) {
    reply(404, {
      error: { message: `No handler for ${req.method} ${req.url}`, type: "invalid_request_error" },
    });
    return;
  }

  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      reply(413, { error: { message: "Request body too large", type: "invalid_request_error" } });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    if (res.writableEnded) return;
    let parsed;
    try {
      parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      reply(400, { error: { message: "Malformed JSON body", type: "invalid_request_error" } });
      return;
    }

    const inputs = Array.isArray(parsed.input) ? parsed.input : [parsed.input ?? ""];
    const dimensions =
      Number.isInteger(parsed.dimensions) && parsed.dimensions > 0 ? parsed.dimensions : DIMENSIONS;

    reply(200, {
      object: "list",
      model: parsed.model ?? "stub-embedding",
      data: inputs.map((input, index) => ({
        object: "embedding",
        index,
        embedding: embed(input, dimensions),
      })),
      usage: { prompt_tokens: 0, total_tokens: 0 },
    });
  });
});

const port = Number(process.argv[2] ?? 8079);
server.listen(port, "0.0.0.0", () => {
  console.log(`embedding stub listening on http://0.0.0.0:${port}/v1/embeddings (${DIMENSIONS} dimensions)`);
});
