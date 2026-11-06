import type * as CubeClient from "@cubejs-client/core";
import jwt from "jsonwebtoken";

/**
 * Cube faked at its client boundary for the chart integration suites: the real `@cubejs-client/core`
 * runs — token handling, `/load` parsing, `tablePivot` — and only the network transport is replaced. So
 * everything Formbricks does before and after Cube is real (validation, date ranges, option grouping, the
 * signed token, the audit event), and a test asserts exactly what reached Cube: the query and the actor.
 *
 * The integration job runs no Cube, so Cube's own tenant filter and its config's actor check are verified
 * manually (spec, "Known gap").
 *
 * Install with:
 *
 *   vi.mock("@cubejs-client/core", async (importOriginal) =>
 *     (await import("@/integration/cube-fake")).fakeCubeModule(await importOriginal()));
 */

export type TCubeCall = {
  /** The decoded JWT claims of the token the query was signed with. */
  claims: jwt.JwtPayload;
  /** The query as Cube received it. */
  query: CubeClient.Query;
};

type TFakeCubeState = {
  calls: TCubeCall[];
  /**
   * Embedded-data key discoveries (ENG-6893), kept apart from `calls`: the first chart query on a dataset
   * scans its keys once (then Valkey answers), which is not the query a test asserts on. They answer
   * `discoveredKeys[<dataset id>]`, most frequent first, none by default.
   */
  discoveries: TCubeCall[];
  discoveredKeys: Record<string, string[]>;
  /** Rows to answer with, keyed by member; members the query asks for but a row omits come back null. */
  rows: Record<string, string | number | null>[];
  /** When set, the next load fails with this error, as an unreachable or rejecting Cube would. */
  failure: Error | null;
  /** When set, answers each load from its query and token instead of `rows`. */
  respond: ((call: TCubeCall) => Record<string, string | number | null>[]) | null;
};

export const cubeFake: TFakeCubeState = {
  calls: [],
  discoveries: [],
  discoveredKeys: {},
  rows: [],
  failure: null,
  respond: null,
};

const EMBEDDED_KEY_DISCOVERY_SOURCE = "charts.embeddedKeyDiscovery";
const EMBEDDED_DATA_KEY_DIMENSION = "FeedbackRecords.embeddedDataKey";

export const resetCubeFake = (): void => {
  cubeFake.calls = [];
  cubeFake.discoveries = [];
  cubeFake.discoveredKeys = {};
  cubeFake.rows = [];
  cubeFake.failure = null;
  cubeFake.respond = null;
};

/** A `/load` answer shaped after the query, so the real client can parse and pivot it. */
const buildLoadResponse = (query: CubeClient.Query, rows: TFakeCubeState["rows"]) => {
  const measures = (query.measures ?? []) as string[];
  const dimensions = (query.dimensions ?? []) as string[];
  const granular = (query.timeDimensions ?? []).filter((timeDimension) => timeDimension.granularity);
  const timeKeys = granular.map((timeDimension) => `${timeDimension.dimension}.${timeDimension.granularity}`);

  return {
    queryType: "regularQuery",
    pivotQuery: { ...query, queryType: "regularQuery" },
    results: [
      {
        query,
        annotation: {
          measures: Object.fromEntries(measures.map((member) => [member, { type: "number" }])),
          dimensions: Object.fromEntries(dimensions.map((member) => [member, { type: "string" }])),
          segments: {},
          timeDimensions: Object.fromEntries(timeKeys.map((key) => [key, { type: "time" }])),
        },
        data: rows.map((row) =>
          Object.fromEntries([...measures, ...dimensions, ...timeKeys].map((key) => [key, row[key] ?? null]))
        ),
      },
    ],
  };
};

const decodeQuery = (raw: unknown): CubeClient.Query =>
  (typeof raw === "string" ? JSON.parse(raw) : raw) as CubeClient.Query;

const fakeTransport = (token: string): CubeClient.ITransport<Response> => ({
  authorization: token,
  request: (_method, params) => ({
    subscribe: <T>(callback: (result: Response, resubscribe: () => Promise<T>) => T): Promise<T> => {
      const query = decodeQuery(params.query);
      const call = { claims: jwt.decode(token) as jwt.JwtPayload, query };
      if (call.claims.source === EMBEDDED_KEY_DISCOVERY_SOURCE) {
        cubeFake.discoveries.push(call);
        const keys = cubeFake.discoveredKeys[String(call.claims.tenantId)] ?? [];
        const rows = keys.slice(0, Number(query.limit ?? keys.length)).map((key) => ({
          [EMBEDDED_DATA_KEY_DIMENSION]: key,
          "FeedbackRecords.count": 1,
        }));
        return Promise.resolve(
          callback(Response.json(buildLoadResponse(query, rows)), () =>
            Promise.reject(new Error("unexpected resubscribe"))
          )
        );
      }
      cubeFake.calls.push(call);

      if (cubeFake.failure) {
        const failure = cubeFake.failure;
        cubeFake.failure = null;
        return Promise.reject(failure);
      }

      return Promise.resolve(
        callback(Response.json(buildLoadResponse(query, cubeFake.respond?.(call) ?? cubeFake.rows)), () =>
          Promise.reject(new Error("unexpected resubscribe"))
        )
      );
    },
  }),
});

export const fakeCubeModule = (actual: typeof CubeClient) => ({
  ...actual,
  default: (token: string, options: CubeClient.CubeApiOptions) =>
    new actual.CubeApi(token, { ...options, transport: fakeTransport(token) }),
});
