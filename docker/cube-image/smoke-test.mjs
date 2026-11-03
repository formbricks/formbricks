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
// Chart fields (ENG-6893, ENG-6894): one submission per row, each with an NPS answer, a delivery answer
// and an embedded `region`, so an embedded filter, an embedded grouping and an answer filter can each be
// checked against numbers written out here.
const FIELDS_TENANT = "smoke-tenant-fields";
const FIELDS_SUBMISSIONS = [
  { nps: 9, delivery: "late", region: "North" },
  { nps: 3, delivery: "late", region: "South" },
  { nps: 10, delivery: "on_time", region: "North" },
  { nps: 6, delivery: null, region: "North" },
];
const FIELDS_KEY = "Area 'region' $1$";
const CONTINUE_WAIT_ATTEMPTS = 60;

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

  const fieldRows = FIELDS_SUBMISSIONS.flatMap(({ nps, delivery, region }, index) => {
    const submission = sqlString(`${FIELDS_TENANT}-${index}`);
    const metadata = sqlString(JSON.stringify({ embedded_data: { [FIELDS_KEY]: region } }));
    return [
      `('formbricks', 'q_nps', 'nps', ${nps}, NULL, ${sqlString(FIELDS_TENANT)}, ${submission}, ${metadata}::jsonb)`,
      ...(delivery
        ? [
            `('formbricks', 'q_delivery', 'categorical', NULL, ${sqlString(delivery)}, ${sqlString(FIELDS_TENANT)}, ${submission}, ${metadata}::jsonb)`,
          ]
        : []),
    ];
  });
  console.log(
    "INSERT INTO feedback_records " +
      "(source_type, field_id, field_type, value_number, value_id, tenant_id, submission_id, metadata) VALUES\n" +
      `${fieldRows.join(",\n")};`
  );
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
  const claims = { edKeys: [FIELDS_KEY], answerKinds: { q_delivery: "choice" } };
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
  if (
    JSON.stringify(groupedCounts) !==
    JSON.stringify([
      ["North", 5],
      ["South", 2],
    ])
  ) {
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

  const metaResponse = await fetch(`${baseUrl}/cubejs-api/v1/meta`, {
    headers: { Authorization: createToken(environment, "smoke-tenant-a", { userId: "smoke-user" }) },
  });
  const meta = await metaResponse.json();
  if (JSON.stringify(meta).includes(region.split(".")[1])) {
    fail("another tenant's /meta lists this tenant's embedded-data key");
  }
  pass("an embedded-data key is not listed in another tenant's /meta");
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
  default:
    fail(`unknown command "${command ?? ""}"`);
}
