/**
 * An in-process fake of the Hub's `/v1/feedback-records` HTTP API, for tests and for a local runtime check
 * of the Feedback Record cleanup (ENG-6785). The Hub is a separate service that is not part of the dev
 * stack, so the real client (`@formbricks/hub`, through `modules/hub/service.ts`) is pointed at this instead.
 *
 * Faithful to what the app relies on, taken from the SDK's generated types and the client code:
 * - `Authorization: Bearer <key>`; anything else is a 401 problem body.
 * - `POST` creates a record and answers 201; a repeated `tenant_id` + `submission_id` + `field_id` is a 409
 *   with code `conflict` (terminal), which is what `reconcileFeedbackRecords` branches on.
 * - `GET` lists, newest `collected_at` first, honouring the repeatable `source_type`, `source_id`,
 *   `submission_id`, `field_id` filters (a record must match any value of each filter given) and `limit`
 *   (default 100, at most 1000; 0 means the default, more than 1000 is a 400). `tenant_id` is required (400
 *   without it), and an empty filter value matches nothing. Paging cursors are not modelled: the cleanup
 *   never uses them, since its own deletes move the pages.
 * - `PATCH` updates the answer fields and bumps `updated_at`; `DELETE` answers 204; both answer 404 for an id
 *   that is not there and 400 for one that is not a UUID. The Hub takes a bare id on both and checks no
 *   tenant, as the cleanup's comments say. Deleting twice is a 404 the second time.
 * - Errors are RFC 9457 problem bodies carrying `type`, `title`, `status`, `detail`, `instance`, `code` and
 *   `request_id`.
 * - `outage = "purge"`: a tenant data purge is running, so every write (POST, PATCH, DELETE) is a 409 with
 *   code `tenant_write_conflict`, which is a different 409 from a duplicate create (`conflict`).
 *
 * All of the above was checked against the real Hub 0.14.1 (ENG-6785, evidence in the task notes). Not
 * modelled: enrichment (sentiment, emotions, translation), taxonomy, webhooks, the purge itself and cursor
 * paging. The SDK's own retries (it re-sends a `tenant_write_conflict` 409 and idempotent calls on 5xx or
 * timeouts) are not modelled either: this answers each request once. Timing is not modelled: the real Hub
 * can also accept a connection and never answer, which the SDK waits out for 60 s per attempt.
 *
 * `handle` takes a standard `Request` and returns a `Response`, so it plugs into `vi.stubGlobal("fetch")` and
 * into a plain `node:http` server (`startFakeHubServer`) alike.
 */
import { randomUUID } from "node:crypto";
import { type IncomingMessage, type Server, createServer } from "node:http";

type TFakeRecord = Record<string, unknown> & {
  id: string;
  tenant_id: string;
  source_type: string;
  source_id?: string;
  submission_id: string;
  field_id: string;
  collected_at: string;
  created_at: string;
  updated_at: string;
};

export type TFakeHubRequestLog = { method: string; path: string; search: string };

/** `down`: every call fails with a 503, as a Hub behind a failing proxy would. `unreachable`: no answer at all. */
export type TFakeHubOutage = "down" | "unreachable" | "purge" | null;

const REQUIRED_CREATE_FIELDS = ["tenant_id", "source_type", "submission_id", "field_id", "field_type"];
const UPDATABLE_FIELDS = [
  "language",
  "metadata",
  "user_id",
  "value_boolean",
  "value_date",
  "value_id",
  "value_number",
  "value_text",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export class FakeHub {
  /** Every call that reached the Hub, in order (an `unreachable` outage records the attempt too). */
  readonly requests: TFakeHubRequestLog[] = [];
  outage: TFakeHubOutage = null;
  /** Called with each request as it arrives, before it is answered: a test's way to act "during" a call. */
  onRequest: ((request: Request) => void) | undefined;
  private readonly store = new Map<string, TFakeRecord>();
  private tick = 0;

  constructor(private readonly apiKey: string = "fake-hub-key") {}

  /** The stored records, optionally narrowed; a copy, so a test cannot change the Hub through it. */
  records(filter: { tenantId?: string; submissionId?: string } = {}): TFakeRecord[] {
    return [...this.store.values()]
      .filter((r) => !filter.tenantId || r.tenant_id === filter.tenantId)
      .filter((r) => !filter.submissionId || r.submission_id === filter.submissionId)
      .map((r) => ({ ...r }));
  }

  /** Seed a record directly, as if an earlier pipeline run had created it. */
  seed(record: Omit<TFakeRecord, "id" | "collected_at" | "created_at" | "updated_at">): TFakeRecord {
    return this.insert(record);
  }

  /** Drop every record, as a fresh Hub. */
  clear(): void {
    this.store.clear();
  }

  count(method: string): number {
    return this.requests.filter((r) => r.method === method).length;
  }

  clearRequests(): void {
    this.requests.length = 0;
  }

  readonly handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    this.requests.push({ method: request.method, path: url.pathname, search: url.search });
    this.onRequest?.(request);

    if (this.outage === "unreachable") throw new TypeError("fetch failed");
    if (this.outage === "down") return problem(503, "service_unavailable", "Hub is down");
    if (request.headers.get("authorization") !== `Bearer ${this.apiKey}`) {
      return problem(401, "unauthorized", "missing or invalid API key");
    }

    const idMatch = /^\/v1\/feedback-records\/([^/]+)$/.exec(url.pathname);
    if (this.outage === "purge" && ["POST", "PATCH", "DELETE"].includes(request.method)) {
      return problem(
        409,
        "tenant_write_conflict",
        "tenant data purge in progress for this tenant; retry later"
      );
    }
    if (url.pathname === "/v1/feedback-records") {
      if (request.method === "GET") return this.list(url);
      if (request.method === "POST") return this.create(request);
    } else if (idMatch) {
      const id = decodeURIComponent(idMatch[1] ?? "");
      if (!UUID.test(id) && request.method !== "POST")
        return problem(400, "validation", "id must be a valid UUID");
      if (request.method === "GET") return this.read(id);
      if (request.method === "PATCH") return this.update(id, request);
      if (request.method === "DELETE") return this.destroy(id);
    }
    return problem(404, "not_found", `no route for ${request.method} ${url.pathname}`);
  };

  private insert(input: Record<string, unknown>): TFakeRecord {
    const now = new Date(Date.now() + this.tick++).toISOString();
    const record = {
      ...input,
      id: randomUUID(),
      collected_at: (input.collected_at as string | undefined) ?? now,
      created_at: now,
      updated_at: now,
    } as TFakeRecord;
    this.store.set(record.id, record);
    return record;
  }

  private async create(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const missing = REQUIRED_CREATE_FIELDS.filter(
      (key) => !body || body[key] === undefined || body[key] === ""
    );
    if (!body || missing.length > 0) return problem(400, "validation", `missing: ${missing.join(", ")}`);

    const duplicate = [...this.store.values()].some(
      (r) =>
        r.tenant_id === body.tenant_id &&
        r.submission_id === body.submission_id &&
        r.field_id === body.field_id
    );
    if (duplicate) return problem(409, "conflict", "feedback record already exists");

    return Response.json(this.insert(body), { status: 201 });
  }

  private list(url: URL): Response {
    const all = (name: string) => url.searchParams.getAll(name);
    const tenant = url.searchParams.get("tenant_id");
    if (!tenant) return problem(400, "validation", "tenant_id is required");
    const [sourceTypes, sourceIds, submissionIds, fieldIds] = [
      all("source_type"),
      all("source_id"),
      all("submission_id"),
      all("field_id"),
    ];
    const requested = Number(url.searchParams.get("limit") ?? 0);
    if (!Number.isInteger(requested) || requested > MAX_LIMIT) {
      return problem(400, "validation", `limit must be an integer of at most ${MAX_LIMIT}`);
    }
    const limit = requested > 0 ? requested : DEFAULT_LIMIT;

    const matches = [...this.store.values()]
      .filter((r) => r.tenant_id === tenant)
      .filter((r) => sourceTypes.length === 0 || sourceTypes.includes(r.source_type))
      .filter((r) => sourceIds.length === 0 || (r.source_id !== undefined && sourceIds.includes(r.source_id)))
      .filter((r) => submissionIds.length === 0 || submissionIds.includes(r.submission_id))
      .filter((r) => fieldIds.length === 0 || fieldIds.includes(r.field_id))
      .sort((a, b) => b.collected_at.localeCompare(a.collected_at) || a.id.localeCompare(b.id));

    return Response.json({ data: matches.slice(0, limit), limit });
  }

  private read(id: string): Response {
    const record = this.store.get(id);
    return record ? Response.json(record) : problem(404, "not_found", "feedback record not found");
  }

  private async update(id: string, request: Request): Promise<Response> {
    const record = this.store.get(id);
    if (!record) return problem(404, "not_found", "feedback record not found");
    const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    for (const key of UPDATABLE_FIELDS) {
      // Absent or null means "leave unchanged", which is how the real Hub reads a pointer field.
      if (body[key] !== undefined && body[key] !== null) record[key] = body[key];
    }
    record.updated_at = new Date(Date.now() + this.tick++).toISOString();
    return Response.json(record);
  }

  private destroy(id: string): Response {
    if (!this.store.delete(id)) return problem(404, "not_found", "feedback record not found");
    return new Response(null, { status: 204 });
  }
}

const problem = (status: number, code: string, detail: string): Response => {
  const requestId = randomUUID();
  const slug = code.replaceAll("_", "-");
  return Response.json(
    {
      type: `https://hub.formbricks.com/problems/${slug}`,
      title: detail,
      status,
      detail,
      instance: "/v1/feedback-records",
      code,
      request_id: requestId,
    },
    { status, headers: { "content-type": "application/problem+json" } }
  );
};

const readBody = async (req: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

/** Serve a `FakeHub` over real HTTP, for a runtime check; resolves with the server and its base URL. */
export const startFakeHubServer = async (
  hub: FakeHub,
  port = 0
): Promise<{ server: Server; url: string; stop: () => Promise<void> }> => {
  const server = createServer(async (req, res) => {
    try {
      const body = req.method === "GET" || req.method === "DELETE" ? undefined : await readBody(req);
      const response = await hub.handle(
        new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: body && body.length > 0 ? new Uint8Array(body) : undefined,
        })
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      // `unreachable`: drop the connection, which the client sees as a network error.
      req.socket.destroy();
    }
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  return {
    server,
    url: `http://127.0.0.1:${boundPort}`,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};
