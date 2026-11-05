// Helper for smoke-test.sh. Dependency-free on purpose (Node >= 20 built-ins only), so it runs on a bare
// CI runner or a laptop without an install step.
//
// It reads `docker compose config --format json` output, so every container the smoke test starts gets
// the image, environment, mounts, entrypoint, command and healthcheck docker/docker-compose.yml
// declares, rather than a hand-kept copy that could drift from it.
import { spawnSync } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// Tenant a queries as a user, tenant b as an API key: the token names exactly one of the two actors.
const TENANTS = {
  "smoke-tenant-a": { sourceName: "smoke-source-a", npsValues: [9, 10, 3], actor: { userId: "smoke-user" } },
  "smoke-tenant-b": { sourceName: "smoke-source-b", npsValues: [0, 6], actor: { apiKeyId: "smoke-api-key" } },
};
const TENANT_FILTER_REJECTION = "tenant filters are enforced by Cube";
// Chart fields: one submission per row, each with an NPS answer, a delivery answer,
// the options picked on a multi-select (one record per option, `<question>__<option>`) and an embedded
// `region`, so an embedded filter, an embedded grouping and answer filters of every kind can each be
// checked against numbers worked out from this table.
const FIELDS_TENANT = "smoke-tenant-fields";
const FIELDS_SUBMISSIONS = [
  { nps: 9, delivery: "late", region: "North", features: ["opt_a", "opt_b"] },
  { nps: 3, delivery: "late", region: "South", features: ["opt_a"] },
  { nps: 10, delivery: "on_time", region: "North", features: [] },
  { nps: 6, delivery: null, region: "North", features: ["opt_b"] },
];
const FIELDS_KEY = "Area 'region' $1$";
const FIELDS_ANSWER_KINDS = { q_delivery: "choice", q_feat: "multi", q_nps: "number" };
// The answer-filter benchmark: a large tenant where every submission answers 25 single-select
// questions, timed with 1 to 25 answer rules (one AnswerFilterN self-join each).
const BENCH_TENANT = "bench-tenant-joins";
const ANSWER_MEMBER_NAME = "FeedbackRecords.answer";
const BENCH_QUESTIONS = 25;
const BENCH_OPTIONS = 4;
const BENCH_DEFAULT_SUBMISSIONS = 20_000;
const CONTINUE_WAIT_ATTEMPTS = 60;
// Correctness against hand-written SQL: a generated tenant whose every submission answers an NPS
// question, a single-select delivery question (skipped by every seventh), a multi-select (option a on
// even submissions, b on every third) and five single-selects, and carries three embedded keys. Each
// check runs one chart query through Cube and the same question as plain SQL against Postgres.
const TRUTH_TENANT = "smoke-tenant-truth";
const TRUTH_DEFAULT_SUBMISSIONS = 3000;
const TRUTH_SINGLE_SELECTS = 5;
const TRUTH_KEYS = {
  region: "region",
  plan: "Plan (billing)",
  tier: "Kundenstufe",
  seats: "Seats (licensed)",
};

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

const pass = (message) => console.log(`PASS: ${message}`);

// Compose output escapes a literal `$` as `$$`; compose itself unescapes it before starting a container.
const unescapeCompose = (value) => String(value).replaceAll("$$", "$");

const readService = (composeJsonPath, serviceName) => {
  const service = JSON.parse(readFileSync(composeJsonPath, "utf8")).services?.[serviceName];
  if (!service) fail(`service "${serviceName}" is missing from the rendered compose file`);
  return service;
};

const serviceEnvironment = (service) =>
  Object.fromEntries(
    Object.entries(service.environment ?? {})
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([name, value]) => [name, unescapeCompose(value)])
  );

const docker = (args) => {
  const result = spawnSync("docker", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
};

// `docker run` the service as compose would, with extra `docker run` options (and optionally another
// image) from the caller. Named volumes are skipped so every run starts from an empty database.
const runService = (composeJsonPath, serviceName, options) => {
  const service = readService(composeJsonPath, serviceName);
  const imageFlag = options.indexOf("--image");
  let image = service.image;
  if (imageFlag !== -1) {
    image = options[imageFlag + 1];
    options.splice(imageFlag, 2);
  }

  const args = ["run", ...options];
  for (const [name, value] of Object.entries(serviceEnvironment(service))) {
    args.push("--env", `${name}=${value}`);
  }
  for (const volume of service.volumes ?? []) {
    if (volume.type === "bind") {
      args.push("--volume", `${volume.source}:${volume.target}${volume.read_only ? ":ro" : ""}`);
    }
  }
  const entrypoint = (service.entrypoint ?? []).map(unescapeCompose);
  if (entrypoint.length > 0) args.push("--entrypoint", entrypoint[0]);
  args.push(image, ...entrypoint.slice(1), ...(service.command ?? []).map(unescapeCompose));

  process.exit(docker(args));
};

// Runs the service's own healthcheck inside a running container. Only the exec form can work: the image
// has no shell for CMD-SHELL.
const runHealthcheck = (composeJsonPath, serviceName, container) => {
  const [form, ...command] = (readService(composeJsonPath, serviceName).healthcheck?.test ?? []).map(
    unescapeCompose
  );
  if (form !== "CMD" || command.length === 0) {
    fail(`the ${serviceName} healthcheck must use the exec form ["CMD", ...]; got "${form}"`);
  }
  const status = docker(["exec", container, ...command]);
  if (status !== 0) fail(`the ${serviceName} compose healthcheck exited ${status} inside ${container}`);
  pass(`the ${serviceName} compose healthcheck exits 0 inside the container`);
};

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;

const printSeedSql = () => {
  const rows = Object.entries(TENANTS).flatMap(([tenantId, { sourceName, npsValues }]) =>
    npsValues.map(
      (value, index) =>
        `('formbricks', ${sqlString(sourceName)}, 'smoke-nps', 'nps', ${Number(value)}, ` +
        `${sqlString(tenantId)}, ${sqlString(`${tenantId}-${index}`)})`
    )
  );
  console.log(
    "INSERT INTO feedback_records " +
      "(source_type, source_name, field_id, field_type, value_number, tenant_id, submission_id) VALUES\n" +
      `${rows.join(",\n")};`
  );

  const fieldRows = FIELDS_SUBMISSIONS.flatMap(({ nps, delivery, region, features }, index) => {
    const tenant = sqlString(FIELDS_TENANT);
    const submission = sqlString(`${FIELDS_TENANT}-${index}`);
    const metadata = sqlString(JSON.stringify({ embedded_data: { [FIELDS_KEY]: region } }));
    return [
      `('formbricks', 'q_nps', NULL, 'nps', ${nps}, NULL, ${tenant}, ${submission}, ${metadata}::jsonb)`,
      ...(delivery
        ? [
            `('formbricks', 'q_delivery', NULL, 'categorical', NULL, ${sqlString(delivery)}, ${tenant}, ${submission}, ${metadata}::jsonb)`,
          ]
        : []),
      ...features.map(
        (option) =>
          `('formbricks', ${sqlString(`q_feat__${option}`)}, 'q_feat', 'categorical', NULL, ${sqlString(option)}, ${tenant}, ${submission}, ${metadata}::jsonb)`
      ),
    ];
  });
  console.log(
    "INSERT INTO feedback_records " +
      "(source_type, field_id, field_group_id, field_type, value_number, value_id, tenant_id, submission_id, metadata) VALUES\n" +
      `${fieldRows.join(",\n")};`
  );
};

// Every submission answers q_nps (submission % 11) and q_c1..q_c25: mostly one of opt_0..opt_2, and the
// rarer opt_3 when the submission number divides by question + 30 (`benchOption`), so every rule keeping
// opt_0..opt_2 removes a few submissions and 25 of them still leave most.
const benchOption = (submission, question) =>
  submission % (question + 30) === 0 ? BENCH_OPTIONS - 1 : (submission + question) % (BENCH_OPTIONS - 1);

const printBenchSeedSql = (submissions) => {
  const tenant = sqlString(BENCH_TENANT);
  console.log(
    "INSERT INTO feedback_records (source_type, field_id, field_type, value_number, tenant_id, submission_id)\n" +
      `SELECT 'formbricks', 'q_nps', 'nps', s % 11, ${tenant}, 'bench-' || s FROM generate_series(1, ${submissions}) s;`
  );
  console.log(
    "INSERT INTO feedback_records (source_type, field_id, field_type, value_id, tenant_id, submission_id)\n" +
      `SELECT 'formbricks', 'q_c' || q, 'categorical', 'opt_' || CASE WHEN s % (q + 30) = 0 THEN ${BENCH_OPTIONS - 1} ELSE (s + q) % ${BENCH_OPTIONS - 1} END, ${tenant}, 'bench-' || s\n` +
      `FROM generate_series(1, ${submissions}) s, generate_series(1, ${BENCH_QUESTIONS}) q;`
  );
  console.log("ANALYZE feedback_records;");
};

// Mirrors getEmbeddedMemberSuffix in docker/cube/cube.js.
const embeddedMember = (key) => {
  const slug = key
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)
    .replace(/_+$/, "");
  const hash = createHash("sha256").update(key, "utf8").digest("hex").slice(0, 8);
  return `FeedbackRecords.ed_${slug ? `${slug}_` : ""}${hash}`;
};

const base64Url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

// Mirrors createCubeApiToken in apps/web/modules/ee/analysis/api/lib/cube-config.ts.
const createToken = (environment, tenantId, actor, extraClaims = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({
    tenantId,
    feedbackDirectoryId: tenantId,
    workspaceId: `${tenantId}-workspace`,
    organizationId: `${tenantId}-organization`,
    ...actor,
    scope: "xm:cube:query",
    source: "v3.charts.preview",
    iat: now,
    exp: now + 5 * 60,
    aud: environment.CUBEJS_JWT_AUDIENCE,
    iss: environment.CUBEJS_JWT_ISSUER,
    jti: randomUUID(),
    ...extraClaims,
  });
  const signature = createHmac("sha256", environment.CUBEJS_API_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
};

const load = async (baseUrl, token, query) => {
  const url = `${baseUrl}/cubejs-api/v1/load?query=${encodeURIComponent(JSON.stringify(query))}`;
  for (let attempt = 1; attempt <= CONTINUE_WAIT_ATTEMPTS; attempt++) {
    const response = await fetch(url, { headers: { Authorization: token } });
    const body = await response.json();
    if (body.error !== "Continue wait") return { status: response.status, body };
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  fail(`Cube still answered "Continue wait" after ${CONTINUE_WAIT_ATTEMPTS} attempts`);
};

const checkQueries = async (composeJsonPath, baseUrl) => {
  const environment = serviceEnvironment(readService(composeJsonPath, "cube"));
  const query = {
    dimensions: ["FeedbackRecords.sourceName"],
    measures: ["FeedbackRecords.count", "FeedbackRecords.npsAverage"],
  };

  for (const [tenantId, { sourceName, npsValues, actor }] of Object.entries(TENANTS)) {
    const { status, body } = await load(baseUrl, createToken(environment, tenantId, actor), query);
    if (status !== 200) fail(`load as ${tenantId} returned HTTP ${status}: ${JSON.stringify(body)}`);

    const rows = (body.data ?? []).map((row) => ({
      sourceName: row["FeedbackRecords.sourceName"],
      count: Number(row["FeedbackRecords.count"]),
      npsAverage: Number(row["FeedbackRecords.npsAverage"]),
    }));
    const expectedAverage = npsValues.reduce((sum, value) => sum + value, 0) / npsValues.length;
    const [row] = rows;
    if (
      rows.length !== 1 ||
      row.sourceName !== sourceName ||
      row.count !== npsValues.length ||
      Math.abs(row.npsAverage - expectedAverage) > 1e-9
    ) {
      fail(`load as ${tenantId} returned ${JSON.stringify(rows)}; expected only its own ${sourceName} rows`);
    }
    pass(`a JWT for ${tenantId} (${Object.keys(actor)[0]}) returns only ${tenantId}'s rows`);
  }

  const [tenantId, otherTenantId] = Object.keys(TENANTS);
  for (const [label, actor, rejection] of [
    ["both userId and apiKeyId", { userId: "smoke-user", apiKeyId: "smoke-api-key" }, "mutually exclusive"],
    ["neither userId nor apiKeyId", {}, "missing userId or apiKeyId"],
  ]) {
    const { status, body } = await load(baseUrl, createToken(environment, tenantId, actor), query);
    if (status === 200 || !String(body.error ?? "").includes(rejection)) {
      fail(`a JWT naming ${label} was not rejected: HTTP ${status} ${JSON.stringify(body)}`);
    }
    pass(`a JWT naming ${label} is rejected`);
  }

  const { status, body } = await load(baseUrl, createToken(environment, tenantId, TENANTS[tenantId].actor), {
    measures: ["FeedbackRecords.count"],
    filters: [{ member: "FeedbackRecords.tenantId", operator: "equals", values: [otherTenantId] }],
  });
  if (status === 200 || !String(body.error ?? "").includes(TENANT_FILTER_REJECTION)) {
    fail(`a query naming FeedbackRecords.tenantId was not rejected: HTTP ${status} ${JSON.stringify(body)}`);
  }
  pass("a query that references FeedbackRecords.tenantId is rejected");

  await checkChartFields(environment, baseUrl);
};

const checkChartFields = async (environment, baseUrl) => {
  const claims = { edKeys: [FIELDS_KEY], answerKinds: FIELDS_ANSWER_KINDS };
  const token = () => createToken(environment, FIELDS_TENANT, { userId: "smoke-user" }, claims);
  const region = embeddedMember(FIELDS_KEY);
  const loadOk = async (query, label) => {
    const { status, body } = await load(baseUrl, token(), query);
    if (status !== 200) fail(`${label}: HTTP ${status} ${JSON.stringify(body)}`);
    return body.data ?? [];
  };

  const grouped = await loadOk(
    { measures: ["FeedbackRecords.count"], dimensions: [region], order: [[region, "asc"]] },
    "embedded group-by"
  );
  const groupedCounts = grouped.map((row) => [row[region], Number(row["FeedbackRecords.count"])]);
  const recordsPerRegion = new Map();
  for (const { region: value, delivery, features } of FIELDS_SUBMISSIONS) {
    recordsPerRegion.set(
      value,
      (recordsPerRegion.get(value) ?? 0) + 1 + (delivery ? 1 : 0) + features.length
    );
  }
  const expectedGrouping = [...recordsPerRegion].sort(([a], [b]) => a.localeCompare(b));
  if (JSON.stringify(groupedCounts) !== JSON.stringify(expectedGrouping)) {
    fail(`grouping by an embedded key returned ${JSON.stringify(groupedCounts)}`);
  }
  pass("an embedded-data key with an awkward name groups records");

  const [filtered] = await loadOk(
    {
      measures: ["FeedbackRecords.count"],
      filters: [
        { member: region, operator: "equals", values: ["North"] },
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps"] },
      ],
    },
    "embedded filter"
  );
  if (Number(filtered?.["FeedbackRecords.count"]) !== 3)
    fail(`an embedded filter returned ${JSON.stringify(filtered)}`);
  pass("an embedded-data filter narrows records exactly");

  const [late] = await loadOk(
    {
      measures: ["FeedbackRecords.count", "FeedbackRecords.npsAverage"],
      filters: [
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps"] },
        { member: "FeedbackRecords.answer", operator: "equals", values: ["q_delivery:late"] },
      ],
    },
    "answer filter"
  );
  if (Number(late?.["FeedbackRecords.count"]) !== 2 || Number(late?.["FeedbackRecords.npsAverage"]) !== 6) {
    fail(`an answer filter returned ${JSON.stringify(late)}; expected NPS 9 and 3 only`);
  }
  pass("an answer filter keeps the records of submissions that answered that way");

  const [notLate] = await loadOk(
    {
      measures: ["FeedbackRecords.count"],
      filters: [
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps"] },
        { member: "FeedbackRecords.answer", operator: "notEquals", values: ["q_delivery:late"] },
      ],
    },
    "answer filter (is not)"
  );
  if (Number(notLate?.["FeedbackRecords.count"]) !== 1) {
    fail(`'is not' returned ${JSON.stringify(notLate)}; the unanswered submission must not match`);
  }
  pass("an 'is not' answer filter never matches a submission that skipped the question");

  const npsOf = (filters, label) =>
    loadOk(
      {
        measures: ["FeedbackRecords.count", "FeedbackRecords.npsAverage"],
        filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps"] }, ...filters],
      },
      label
    ).then(([row]) => ({
      count: Number(row?.["FeedbackRecords.count"] ?? 0),
      average: Number(row?.["FeedbackRecords.npsAverage"]),
    }));
  const expectNps = (actual, submissions, label) => {
    const average = submissions.reduce((sum, { nps }) => sum + nps, 0) / submissions.length;
    if (actual.count !== submissions.length || Math.abs(actual.average - average) > 1e-9) {
      fail(
        `${label} returned ${JSON.stringify(actual)}; expected ${submissions.length} records averaging ${average}`
      );
    }
    pass(label);
  };

  // "Is any of" on a multi-select: a submission that picked both options joins two option records, and
  // must still be counted once.
  expectNps(
    await npsOf(
      [{ member: "FeedbackRecords.answer", operator: "equals", values: ["q_feat:opt_a", "q_feat:opt_b"] }],
      "multi-select any-of"
    ),
    FIELDS_SUBMISSIONS.filter(({ features }) => features.length > 0),
    "a multi-select 'is any of' counts a submission that picked several options once"
  );

  // A number question's rule tests the number column.
  const [promoterDeliveries] = await loadOk(
    {
      measures: ["FeedbackRecords.count"],
      filters: [
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_delivery"] },
        { member: "FeedbackRecords.answer", operator: "equals", values: ["q_nps:9", "q_nps:10"] },
      ],
    },
    "number answer filter"
  );
  const expectedPromoterDeliveries = FIELDS_SUBMISSIONS.filter(
    ({ nps, delivery }) => delivery && nps >= 9
  ).length;
  if (Number(promoterDeliveries?.["FeedbackRecords.count"]) !== expectedPromoterDeliveries) {
    fail(`a number answer filter returned ${JSON.stringify(promoterDeliveries)}`);
  }
  pass("a number answer filter keeps the records of submissions with that score");

  // Several rules, each its own join, all applied.
  expectNps(
    await npsOf(
      [
        { member: "FeedbackRecords.answer", operator: "equals", values: ["q_delivery:late"] },
        { member: "FeedbackRecords.answer", operator: "equals", values: ["q_feat:opt_b"] },
      ],
      "several answer rules"
    ),
    FIELDS_SUBMISSIONS.filter(({ delivery, features }) => delivery === "late" && features.includes("opt_b")),
    "several answer rules all narrow, each on its own join"
  );

  const metaResponse = await fetch(`${baseUrl}/cubejs-api/v1/meta`, {
    headers: { Authorization: createToken(environment, "smoke-tenant-a", { userId: "smoke-user" }) },
  });
  const meta = await metaResponse.json();
  if (JSON.stringify(meta).includes(region.split(".")[1])) {
    fail("another tenant's /meta lists this tenant's embedded-data key");
  }
  pass("an embedded-data key is not listed in another tenant's /meta");
};

const printTruthSeedSql = (submissions) => {
  const tenant = sqlString(TRUTH_TENANT);
  const metadata =
    "jsonb_build_object('embedded_data', jsonb_build_object(" +
    `${sqlString(TRUTH_KEYS.region)}, (ARRAY['North','South','East'])[s % 3 + 1], ` +
    `${sqlString(TRUTH_KEYS.plan)}, (ARRAY['free','pro','team','enterprise'])[s % 4 + 1], ` +
    `${sqlString(TRUTH_KEYS.tier)}, CASE WHEN s % 5 = 0 THEN 'gold' ELSE 'silver' END, ` +
    // A number stored as a JSON number, as numeric text, and now and then as text no number reads.
    `${sqlString(TRUTH_KEYS.seats)}, CASE WHEN s % 6 = 0 THEN to_jsonb('n/a'::text) ` +
    `WHEN s % 2 = 0 THEN to_jsonb(s % 50) ELSE to_jsonb(' ' || (s % 50)::text || '.0') END))`;
  const insert = (columns, select) =>
    console.log(
      `INSERT INTO feedback_records (source_type, tenant_id, submission_id, metadata, ${columns})\n` +
        `SELECT 'formbricks', ${tenant}, 'truth-' || s, ${metadata}, ${select};`
    );
  insert(
    "field_id, field_type, value_number",
    `'q_nps', 'nps', s % 11 FROM generate_series(1, ${submissions}) s`
  );
  insert(
    "field_id, field_type, value_id",
    `'q_delivery', 'categorical', CASE WHEN s % 2 = 0 THEN 'late' ELSE 'on_time' END ` +
      `FROM generate_series(1, ${submissions}) s WHERE s % 7 <> 0`
  );
  insert(
    "field_id, field_group_id, field_type, value_id",
    `'q_feat__opt_a', 'q_feat', 'categorical', 'opt_a' FROM generate_series(1, ${submissions}) s WHERE s % 2 = 0`
  );
  insert(
    "field_id, field_group_id, field_type, value_id",
    `'q_feat__opt_b', 'q_feat', 'categorical', 'opt_b' FROM generate_series(1, ${submissions}) s WHERE s % 3 = 0`
  );
  insert(
    "field_id, field_type, value_id",
    `'q_s' || q, 'categorical', 'opt_' || ((s * q + q) % 3) ` +
      `FROM generate_series(1, ${submissions}) s, generate_series(1, ${TRUTH_SINGLE_SELECTS}) q`
  );
  console.log("ANALYZE feedback_records;");
};

/** Rows of a plain SQL query against the smoke Postgres, as arrays of strings. */
const sqlRows = (postgresContainer, sql) => {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      postgresContainer,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-F",
      "|",
      "-U",
      "postgres",
      "-d",
      "formbricks",
    ],
    { input: sql, encoding: "utf8" }
  );
  if (result.status !== 0) fail(`ground-truth SQL failed: ${result.stderr}`);
  return result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("|"));
};

const checkCorrectness = async (composeJsonPath, baseUrl, postgresContainer) => {
  const environment = serviceEnvironment(readService(composeJsonPath, "cube"));
  const answerKinds = {
    q_delivery: "choice",
    q_feat: "multi",
    ...Object.fromEntries(
      Array.from({ length: TRUTH_SINGLE_SELECTS }, (_, index) => [`q_s${index + 1}`, "choice"])
    ),
  };
  const token = createToken(
    environment,
    TRUTH_TENANT,
    { userId: "smoke-user" },
    { edKeys: Object.values(TRUTH_KEYS).sort(), answerKinds }
  );
  const member = (name) => embeddedMember(TRUTH_KEYS[name]);
  const tenant = sqlString(TRUTH_TENANT);
  const answered = (where) =>
    `EXISTS (SELECT 1 FROM feedback_records a WHERE a.tenant_id = r.tenant_id ` +
    `AND a.submission_id = r.submission_id AND ${where})`;
  const ed = (name) => `r.metadata->'embedded_data'->>${sqlString(TRUTH_KEYS[name])}`;
  const timed = async (label, query) => {
    const started = performance.now();
    const { status, body } = await load(baseUrl, token, query);
    const elapsed = performance.now() - started;
    if (status !== 200) fail(`${label}: HTTP ${status} ${JSON.stringify(body)}`);
    return { rows: body.data ?? [], elapsed };
  };
  const nps = { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps"] };
  const npsTruth = (where) =>
    sqlRows(
      postgresContainer,
      `SELECT count(*), coalesce(round(avg(r.value_number)::numeric, 9), 0) FROM feedback_records r ` +
        `WHERE r.tenant_id = ${tenant} AND r.field_id = 'q_nps' AND ${where};`
    )[0].map(Number);
  const expectSame = (label, actual, expected, elapsed) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      fail(`${label}: Cube returned ${JSON.stringify(actual)}; SQL says ${JSON.stringify(expected)}`);
    }
    pass(`${label}: ${JSON.stringify(actual)} matches SQL (${elapsed.toFixed(0)} ms)`);
  };
  const npsResult = (rows) => {
    const [row] = rows;
    const count = Number(row?.["FeedbackRecords.count"] ?? 0);
    const average = row?.["FeedbackRecords.npsAverage"];
    return [count, count === 0 || average == null ? 0 : Math.round(Number(average) * 1e9) / 1e9];
  };
  const npsQuery = (filters) => ({
    measures: ["FeedbackRecords.count", "FeedbackRecords.npsAverage"],
    filters: [nps, ...filters],
  });

  // An OR group of answer rules: late deliveries, or option b picked on the multi-select.
  {
    const { rows, elapsed } = await timed(
      "answer OR group",
      npsQuery([
        {
          or: [
            { member: ANSWER_MEMBER_NAME, operator: "equals", values: ["q_delivery:late"] },
            { member: ANSWER_MEMBER_NAME, operator: "equals", values: ["q_feat:opt_b"] },
          ],
        },
      ])
    );
    expectSame(
      "an OR group of answer rules",
      npsResult(rows),
      npsTruth(
        `(${answered("a.field_id = 'q_delivery' AND a.value_id = 'late'")} OR ` +
          `${answered("a.field_group_id = 'q_feat' AND a.field_id = 'q_feat__opt_b'")})`
      ),
      elapsed
    );
  }

  // Five answer rules, all applied: each single-select keeps two of its three options, one "is not".
  {
    const rules = Array.from({ length: TRUTH_SINGLE_SELECTS }, (_, index) => {
      const question = `q_s${index + 1}`;
      return index === 0
        ? { member: ANSWER_MEMBER_NAME, operator: "notEquals", values: [`${question}:opt_2`] }
        : {
            member: ANSWER_MEMBER_NAME,
            operator: "equals",
            values: [`${question}:opt_0`, `${question}:opt_1`],
          };
    });
    const where = Array.from({ length: TRUTH_SINGLE_SELECTS }, (_, index) => {
      const question = `q_s${index + 1}`;
      return answered(
        `a.field_id = '${question}' AND ` +
          (index === 0 ? "a.value_id <> 'opt_2'" : "a.value_id IN ('opt_0', 'opt_1')")
      );
    }).join(" AND ");
    const { rows, elapsed } = await timed("five answer rules", npsQuery(rules));
    expectSame("five answer rules", npsResult(rows), npsTruth(where), elapsed);
  }

  // Two embedded filters (an equals moved onto the containment twin, and a notEquals) and an embedded
  // grouping, in one query.
  {
    const { rows, elapsed } = await timed("embedded filters and grouping", {
      measures: ["FeedbackRecords.count"],
      dimensions: [member("region")],
      filters: [
        nps,
        { member: member("plan"), operator: "equals", values: ["pro", "team"] },
        { member: member("tier"), operator: "notEquals", values: ["gold"] },
      ],
      order: [[member("region"), "asc"]],
    });
    const actual = rows.map((row) => [row[member("region")], Number(row["FeedbackRecords.count"])]);
    const expected = sqlRows(
      postgresContainer,
      `SELECT ${ed("region")}, count(*) FROM feedback_records r WHERE r.tenant_id = ${tenant} ` +
        `AND r.field_id = 'q_nps' AND ${ed("plan")} IN ('pro', 'team') AND ${ed("tier")} <> 'gold' ` +
        `GROUP BY 1 ORDER BY 1;`
    ).map(([region, count]) => [region, Number(count)]);
    if (expected.length === 0) fail("the embedded ground truth is empty; the seed is wrong");
    expectSame("two embedded filters and an embedded grouping", actual, expected, elapsed);
  }

  // A number comparison on an embedded key's numeric twin: JSON numbers and numeric text compare as
  // numbers ("9" is not above "20"), and text no number reads ("n/a") is no value rather than an error.
  {
    const seats = member("seats").replace("FeedbackRecords.ed_", "FeedbackRecords.edn_");
    const { rows, elapsed } = await timed(
      "embedded number comparison",
      npsQuery([
        { member: seats, operator: "gt", values: ["20"] },
        { member: seats, operator: "lte", values: ["45"] },
      ])
    );
    const number = `CASE WHEN ${ed("seats")} <> 'n/a' THEN (${ed("seats")})::numeric END`;
    const truth = npsTruth(`${number} > 20 AND ${number} <= 45`);
    if (truth[0] === 0) fail("the embedded number ground truth is empty; the seed is wrong");
    expectSame("an embedded number comparison", npsResult(rows), truth, elapsed);
  }

  // Disjoint picks: a dashboard pick that contradicts the chart's own filter narrows to nothing.
  {
    const { rows, elapsed } = await timed("disjoint embedded picks", {
      measures: ["FeedbackRecords.count"],
      filters: [
        nps,
        { member: member("region"), operator: "equals", values: ["North"] },
        { member: member("region"), operator: "equals", values: ["South"] },
      ],
    });
    expectSame(
      "disjoint embedded picks",
      npsResult(rows)[0],
      npsTruth(`${ed("region")} = 'North' AND ${ed("region")} = 'South'`)[0],
      elapsed
    );
  }
  {
    const { rows, elapsed } = await timed(
      "disjoint answer picks",
      npsQuery([
        { member: ANSWER_MEMBER_NAME, operator: "equals", values: ["q_s1:opt_0"] },
        { member: ANSWER_MEMBER_NAME, operator: "equals", values: ["q_s1:opt_1"] },
      ])
    );
    const truth = npsTruth(
      `${answered("a.field_id = 'q_s1' AND a.value_id = 'opt_0'")} AND ` +
        `${answered("a.field_id = 'q_s1' AND a.value_id = 'opt_1'")}`
    );
    if (truth[0] !== 0) fail(`disjoint answer picks: SQL counted ${truth[0]}; the seed is wrong`);
    expectSame("disjoint answer picks", npsResult(rows), truth, elapsed);
  }
};

// Times a chart query with 0, 1, 5, 10 and 25 answer rules over the benchmark tenant and checks every
// count against the seeded data. A filter on a source type no record has makes each run's SQL unique, so
// Cube's result cache never answers it; the second run shows Postgres with warm buffers. One line per run.
const benchJoins = async (composeJsonPath, baseUrl, submissions) => {
  const environment = serviceEnvironment(readService(composeJsonPath, "cube"));
  const answerKinds = Object.fromEntries(
    Array.from({ length: BENCH_QUESTIONS }, (_, index) => [`q_c${index + 1}`, "choice"])
  );
  const token = () => createToken(environment, BENCH_TENANT, { userId: "bench-user" }, { answerKinds });
  // Each rule keeps opt_0..opt_2 ("is any of" three values) and drops the rare opt_3.
  const kept = Array.from({ length: BENCH_OPTIONS - 1 }, (_, option) => option);
  for (const ruleCount of [0, 1, 5, 10, 25]) {
    const questions = Array.from({ length: ruleCount }, (_, index) => index + 1);
    const query = (nonce) => ({
      measures: ["FeedbackRecords.count"],
      filters: [
        { member: "FeedbackRecords.sourceType", operator: "notEquals", values: [`bench-${nonce}`] },
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["q_nps"] },
        ...questions.map((question) => ({
          member: "FeedbackRecords.answer",
          operator: "equals",
          values: kept.map((option) => `q_c${question}:opt_${option}`),
        })),
      ],
    });
    let expected = 0;
    for (let submission = 1; submission <= submissions; submission++) {
      if (questions.every((question) => kept.includes(benchOption(submission, question)))) expected++;
    }
    for (const run of ["cold", "warm"]) {
      const started = performance.now();
      const { status, body } = await load(baseUrl, token(), query(randomUUID()));
      const elapsed = performance.now() - started;
      if (status !== 200) fail(`${ruleCount} rules: HTTP ${status} ${JSON.stringify(body)}`);
      const count = Number(body.data?.[0]?.["FeedbackRecords.count"] ?? 0);
      if (count !== expected) fail(`${ruleCount} rules counted ${count}; expected ${expected}`);
      console.log(
        `BENCH: ${ruleCount} answer rules, ${submissions} submissions (${submissions * (BENCH_QUESTIONS + 1)} records), ${run}: ${elapsed.toFixed(0)} ms, count ${count}`
      );
    }
  }
};

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case "random-hex":
    console.log(randomBytes(Number(args[0] ?? 16)).toString("hex"));
    break;
  case "run":
    runService(args[0], args[1], args.slice(2));
    break;
  case "healthcheck":
    runHealthcheck(args[0], args[1], args[2]);
    break;
  case "seed-sql":
    printSeedSql();
    break;
  case "check-queries":
    await checkQueries(args[0], args[1]);
    break;
  case "truth-seed-sql":
    printTruthSeedSql(Number(args[0] ?? TRUTH_DEFAULT_SUBMISSIONS));
    break;
  case "check-correctness":
    await checkCorrectness(args[0], args[1], args[2]);
    break;
  case "bench-seed-sql":
    printBenchSeedSql(Number(args[0] ?? BENCH_DEFAULT_SUBMISSIONS));
    break;
  case "bench-joins":
    await benchJoins(args[0], args[1], Number(args[2] ?? BENCH_DEFAULT_SUBMISSIONS));
    break;
  default:
    fail(`unknown command "${command ?? ""}"`);
}
