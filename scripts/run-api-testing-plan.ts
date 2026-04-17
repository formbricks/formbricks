import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

type Permission = "read" | "write" | "manage";
type CaseStatus = "PASS" | "FAIL" | "SKIP";
type KeyAlias = "K1_W1_DEV_MANAGE" | "K2_W1_PROD_READ" | "K3_W2_DEV_MANAGE" | "K4_W2_PROD_WRITE";
type ScopeId = "w1Dev" | "w1Prod" | "w2Dev" | "w2Prod";
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ScopeFixtureConfig = {
  environmentId: string;
  workspaceId: string;
  surveyId: string;
  responseId: string;
  webhookId: string;
  actionClassId: string;
  contactId?: string;
  contactAttributeKeyId?: string;
  segmentId?: string;
};

type RunnerConfig = {
  baseUrl: string;
  planPath?: string;
  features?: {
    eeContacts?: boolean;
    storage?: boolean;
  };
  timeouts?: {
    startupWaitMs?: number;
    healthPollIntervalMs?: number;
    requestMs?: number;
    stepMs?: number;
    maxConsecutiveNetworkFailures?: number;
  };
  expectations?: {
    v1ManagementMeStatusByKey?: Partial<Record<KeyAlias, number>>;
    v2MeStatusByKey?: Partial<Record<KeyAlias, number>>;
  };
  scopes: Record<ScopeId, ScopeFixtureConfig>;
};

type RunnerArgs = {
  configPath: string;
  outputPath?: string;
  readOnly: boolean;
};

type ParsedKey = {
  alias: KeyAlias;
  value: string;
  permission: Permission;
  scopeId: ScopeId;
};

type HttpResult = {
  url: string;
  method: HttpMethod;
  status: number;
  durationMs: number;
  text: string;
  json: unknown;
  headers: Headers;
};

type HttpTranscriptEntry = {
  keyAlias?: KeyAlias;
  method: HttpMethod;
  url: string;
  requestBody?: unknown;
  status?: number;
  durationMs?: number;
  responseText?: string;
  responseHeaders?: Record<string, string>;
  error?: string;
};

type CaseResult = {
  name: string;
  status: CaseStatus;
  durationMs: number;
  details: string[];
  transcripts: HttpTranscriptEntry[];
};

const KEY_ALIASES: KeyAlias[] = [
  "K1_W1_DEV_MANAGE",
  "K2_W1_PROD_READ",
  "K3_W2_DEV_MANAGE",
  "K4_W2_PROD_WRITE",
];

const KEY_META: Record<KeyAlias, { permission: Permission; scopeId: ScopeId; label: string }> = {
  K1_W1_DEV_MANAGE: { permission: "manage", scopeId: "w1Dev", label: "Workspace 1 / Dev / manage" },
  K2_W1_PROD_READ: { permission: "read", scopeId: "w1Prod", label: "Workspace 1 / Prod / read" },
  K3_W2_DEV_MANAGE: { permission: "manage", scopeId: "w2Dev", label: "Workspace 2 / Dev / manage" },
  K4_W2_PROD_WRITE: { permission: "write", scopeId: "w2Prod", label: "Workspace 2 / Prod / write" },
};

const FOREIGN_SCOPE_BY_SCOPE: Record<ScopeId, ScopeId> = {
  w1Dev: "w2Dev",
  w1Prod: "w2Prod",
  w2Dev: "w1Dev",
  w2Prod: "w1Prod",
};

const DEFAULT_TIMEOUTS = {
  startupWaitMs: 120_000,
  healthPollIntervalMs: 2_000,
  requestMs: 15_000,
  stepMs: 30_000,
  maxConsecutiveNetworkFailures: 3,
};

const DEFAULT_V1_UNAUTHORIZED = [401, 403, 404];
const DEFAULT_V2_UNAUTHORIZED = [401, 403, 404];
const DEFAULT_V3_UNAUTHORIZED = [403, 404];

const createdResources: {
  surveys: Partial<Record<KeyAlias, string>>;
  responsesV1: Partial<Record<KeyAlias, string>>;
  responsesV2: Partial<Record<KeyAlias, string>>;
  actionClasses: Partial<Record<KeyAlias, string>>;
  webhooksV1: Partial<Record<KeyAlias, string>>;
  webhooksV2: Partial<Record<KeyAlias, string>>;
  contactAttributeKeysV1: Partial<Record<KeyAlias, string>>;
  contactAttributeKeysV2: Partial<Record<KeyAlias, string>>;
  contactsV2: Partial<Record<KeyAlias, string>>;
} = {
  surveys: {},
  responsesV1: {},
  responsesV2: {},
  actionClasses: {},
  webhooksV1: {},
  webhooksV2: {},
  contactAttributeKeysV1: {},
  contactAttributeKeysV2: {},
  contactsV2: {},
};

let currentCaseTranscripts: HttpTranscriptEntry[] = [];
let READ_ONLY_MODE = false;

const MUTATING_CASE_PATTERN =
  /\b(create|put|delete|update|bulk|signed upload|honors permissions)\b/i;

class SkipCaseError extends Error {}
class ConfigError extends Error {}

function isPermissionAllowed(permission: Permission, method: HttpMethod): boolean {
  if (method === "GET") {
    return true;
  }

  if (method === "DELETE") {
    return permission === "manage";
  }

  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return permission === "write" || permission === "manage";
  }

  return false;
}

function parseArgs(argv: string[]): RunnerArgs {
  let configPath = "api-testing-plan.config.json";
  let outputPath: string | undefined;
  let readOnly = false;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--config" && argv[index + 1]) {
      configPath = argv[index + 1];
      index++;
      continue;
    }

    if (arg === "--output" && argv[index + 1]) {
      outputPath = argv[index + 1];
      index++;
      continue;
    }

    if (arg === "--read-only") {
      readOnly = true;
    }
  }

  if (process.env.READ_ONLY === "1" || process.env.READ_ONLY?.toLowerCase() === "true") {
    readOnly = true;
  }

  return { configPath, outputPath, readOnly };
}

function placeholder(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  return value.startsWith("REPLACE_WITH_");
}

function unwrapApiData(payload: unknown): unknown {
  let current: unknown = payload;

  for (let depth = 0; depth < 4; depth++) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return current;
    }

    if (!("data" in current)) {
      return current;
    }

    current = (current as { data: unknown }).data;
  }

  return current;
}

function extractItems(payload: unknown): Record<string, unknown>[] {
  const unwrapped = unwrapApiData(payload);

  if (Array.isArray(unwrapped)) {
    return unwrapped as Record<string, unknown>[];
  }

  if (unwrapped && typeof unwrapped === "object" && "data" in unwrapped) {
    const nested = (unwrapped as { data: unknown }).data;
    if (Array.isArray(nested)) {
      return nested as Record<string, unknown>[];
    }
  }

  return [];
}

function extractObject(payload: unknown): Record<string, unknown> {
  const unwrapped = unwrapApiData(payload);

  if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
    return unwrapped as Record<string, unknown>;
  }

  return {};
}

function getStringField(payload: unknown, field: string): string | undefined {
  const object = extractObject(payload);
  const value = object[field];
  return typeof value === "string" ? value : undefined;
}

function sanitizeFileTimestamp(date: Date): string {
  return date.toISOString().replaceAll(":", "-");
}

function nowLabel(date: Date): string {
  return date.toISOString();
}

function formatJson(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function formatTextBlock(text: string): string {
  return text.trim().length > 0 ? text : "(empty)";
}

function pickInterestingHeaders(headers: Headers): Record<string, string> {
  const picked: Record<string, string> = {};
  const allowedHeaders = [
    "content-type",
    "content-length",
    "x-request-id",
    "location",
    "cache-control",
  ];

  for (const headerName of allowedHeaders) {
    const value = headers.get(headerName);
    if (value) {
      picked[headerName] = value;
    }
  }

  return picked;
}

async function loadJsonConfig(configPath: string): Promise<RunnerConfig> {
  const file = await readFile(configPath, "utf8");
  return JSON.parse(file) as RunnerConfig;
}

async function loadKeysFromPlan(planPath: string): Promise<Record<KeyAlias, ParsedKey>> {
  const markdown = await readFile(planPath, "utf8");
  const lines = markdown.split(/\r?\n/);
  const parsed = new Map<KeyAlias, ParsedKey>();

  for (const line of lines) {
    const match = line.match(/^\|\s*`?(K[1-4]_[A-Z0-9_]+)`?\s*\|\s*`?(fbk_[^`|]+)`?\s*\|/);
    if (!match) {
      continue;
    }

    const alias = match[1] as KeyAlias;
    if (!KEY_ALIASES.includes(alias)) {
      continue;
    }

    parsed.set(alias, {
      alias,
      value: match[2].trim(),
      permission: KEY_META[alias].permission,
      scopeId: KEY_META[alias].scopeId,
    });
  }

  const missing = KEY_ALIASES.filter((alias) => !parsed.has(alias));
  if (missing.length > 0) {
    throw new ConfigError(
      `Missing API keys in ${planPath}: ${missing.join(", ")}. Update the plan file or point --config.planPath to the correct markdown file.`
    );
  }

  return Object.fromEntries(KEY_ALIASES.map((alias) => [alias, parsed.get(alias)!])) as Record<KeyAlias, ParsedKey>;
}

function validateConfig(config: RunnerConfig) {
  if (!config.baseUrl) {
    throw new ConfigError("`baseUrl` is required in api-testing-plan.config.json.");
  }

  for (const scopeId of Object.keys(config.scopes) as ScopeId[]) {
    const scope = config.scopes[scopeId];
    const requiredFields: (keyof ScopeFixtureConfig)[] = [
      "environmentId",
      "workspaceId",
      "surveyId",
      "responseId",
      "webhookId",
      "actionClassId",
    ];

    if (config.features?.eeContacts) {
      requiredFields.push("contactId", "contactAttributeKeyId", "segmentId");
    }

    for (const field of requiredFields) {
      const value = scope[field];
      if (typeof value !== "string" || placeholder(value)) {
        throw new ConfigError(
          `Missing or placeholder value for scopes.${scopeId}.${field}. Fill api-testing-plan.config.json before running.`
        );
      }
    }
  }
}

function ensureScope(config: RunnerConfig, scopeId: ScopeId): ScopeFixtureConfig {
  const scope = config.scopes[scopeId];
  if (!scope) {
    throw new ConfigError(`Unknown scope: ${scopeId}`);
  }
  return scope;
}

function buildQuery(pathname: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(pathname, "http://local.invalid");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

function getExpectation(
  expected: number | number[],
  actual: number,
  label: string
): { ok: boolean; message: string } {
  const allowed = Array.isArray(expected) ? expected : [expected];
  const ok = allowed.includes(actual);
  return {
    ok,
    message: ok
      ? `${label}: expected ${allowed.join("/")} and got ${actual}`
      : `${label}: expected ${allowed.join("/")} but got ${actual}`,
  };
}

async function httpRequest(
  config: RunnerConfig,
  key: ParsedKey | undefined,
  method: HttpMethod,
  requestPath: string,
  body?: unknown
): Promise<HttpResult> {
  const url = new URL(requestPath, config.baseUrl).toString();
  const transcript: HttpTranscriptEntry = {
    keyAlias: key?.alias,
    method,
    url,
    requestBody: body,
  };
  currentCaseTranscripts.push(transcript);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`Request timed out after ${config.timeouts?.requestMs ?? DEFAULT_TIMEOUTS.requestMs}ms`)),
    config.timeouts?.requestMs ?? DEFAULT_TIMEOUTS.requestMs
  );
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "x-api-key": key.value } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let json: unknown = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    transcript.status = response.status;
    transcript.durationMs = Date.now() - startedAt;
    transcript.responseText = text;
    transcript.responseHeaders = pickInterestingHeaders(response.headers);

    return {
      url,
      method,
      status: response.status,
      durationMs: transcript.durationMs,
      text,
      json,
      headers: response.headers,
    };
  } catch (error) {
    transcript.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureHealthy(config: RunnerConfig, logPath: string) {
  const startupWaitMs = config.timeouts?.startupWaitMs ?? DEFAULT_TIMEOUTS.startupWaitMs;
  const healthPollIntervalMs =
    config.timeouts?.healthPollIntervalMs ?? DEFAULT_TIMEOUTS.healthPollIntervalMs;
  const startedAt = Date.now();
  let lastError = "No response yet";

  while (Date.now() - startedAt < startupWaitMs) {
    try {
      const response = await httpRequest(config, undefined, "GET", "/api/v2/health");
      if (response.status === 200) {
        await appendFile(
          logPath,
          `## Startup Health Check\n- Status: PASS\n- URL: \`${response.url}\`\n- Response: \`${response.status}\`\n- Duration: ${response.durationMs}ms\n\n`
        );
        return;
      }

      lastError = `Health endpoint returned ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, healthPollIntervalMs));
  }

  throw new Error(`App never became healthy within ${startupWaitMs}ms. Last error: ${lastError}`);
}

async function createLogFile(outputPath: string, configPath: string, config: RunnerConfig, planPath: string) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const startedAt = new Date();
  const header = [
    "# API Testing Plan Run Log",
    "",
    `- Started At: ${nowLabel(startedAt)}`,
    `- Base URL: \`${config.baseUrl}\``,
    `- Config: \`${configPath}\``,
    `- Plan: \`${planPath}\``,
    `- EE Contacts Enabled: \`${config.features?.eeContacts ? "yes" : "no"}\``,
    `- Storage Enabled: \`${config.features?.storage ? "yes" : "no"}\``,
    `- Read Only Mode: \`${READ_ONLY_MODE ? "yes" : "no"}\``,
    "- Request logging: `enabled`",
    "- API key values are redacted; key aliases are logged instead.",
    "",
  ].join("\n");
  await writeFile(outputPath, `${header}\n`, "utf8");
}

async function appendCase(logPath: string, result: CaseResult) {
  const details = result.details.map((line) => `- ${line}`).join("\n");
  const transcripts = result.transcripts
    .map((transcript, index) => {
      const requestBlock =
        transcript.requestBody === undefined ? "(none)" : formatJson(transcript.requestBody);
      const headersBlock = formatJson(transcript.responseHeaders ?? {});
      const responseBlock = formatTextBlock(transcript.responseText ?? "");
      const metaLines = [
        `### HTTP ${index + 1}`,
        `- Key Alias: \`${transcript.keyAlias ?? "none"}\``,
        `- Request: \`${transcript.method} ${transcript.url}\``,
        `- Status: \`${transcript.status ?? "error"}\``,
        `- Duration: ${transcript.durationMs ?? 0}ms`,
        ...(transcript.error ? [`- Error: \`${transcript.error}\``] : []),
        "",
        "**Request Body**",
        "```json",
        requestBlock,
        "```",
        "",
        "**Response Headers**",
        "```json",
        headersBlock,
        "```",
        "",
        "**Response Body**",
        "```json",
        responseBlock,
        "```",
      ];

      return metaLines.join("\n");
    })
    .join("\n\n");
  await appendFile(
    logPath,
    `## ${result.status} ${result.name}\n${details}\n- Duration: ${result.durationMs}ms\n\n${transcripts}\n\n`,
    "utf8"
  );
}

function scopeFixture(config: RunnerConfig, key: ParsedKey) {
  return ensureScope(config, key.scopeId);
}

function foreignScopeFixture(config: RunnerConfig, key: ParsedKey) {
  return ensureScope(config, FOREIGN_SCOPE_BY_SCOPE[key.scopeId]);
}

function surveyCreateBody(environmentId: string, suffix: string) {
  return {
    environmentId,
    type: "link",
    name: `API Plan Survey ${suffix}`,
    questions: [
      {
        id: `q_${suffix}`.slice(0, 24),
        type: "openText",
        headline: { default: "What would you like to know?" },
        required: false,
        inputType: "text",
        subheader: { default: "Generated by the API plan runner." },
        placeholder: { default: "Type your answer here..." },
        charLimit: { enabled: false },
      },
    ],
  };
}

function responseBody(surveyId: string, suffix: string) {
  return {
    createdAt: "2021-01-01T00:00:00.000Z",
    updatedAt: "2021-01-01T00:00:00.000Z",
    surveyId,
    finished: true,
    language: "en",
    data: {},
    variables: {
      source: `api-plan-${suffix}`,
    },
    ttc: {},
    meta: {
      source: "https://example.com",
      url: "https://example.com",
      country: "US",
      action: "submit",
    },
  };
}

function actionClassBody(environmentId: string, suffix: string) {
  return {
    environmentId,
    name: `API Plan Action ${suffix}`,
    description: "Generated by the API testing plan runner",
    type: "code",
    key: `api_plan_action_${suffix}`,
  };
}

function webhookBody(environmentId: string, surveyId: string, suffix: string) {
  return {
    environmentId,
    name: `API Plan Webhook ${suffix}`,
    url: `https://example.com/webhook/${suffix}`,
    source: "user",
    triggers: ["responseFinished"],
    surveyIds: [surveyId],
  };
}

function contactAttributeKeyV1Body(environmentId: string, suffix: string) {
  return {
    environmentId,
    key: `api_plan_key_${suffix}`,
    name: `API Plan Key ${suffix}`,
    type: "custom",
    description: "Generated by the API testing plan runner",
    dataType: "text",
  };
}

function contactAttributeKeyV2Body(environmentId: string, suffix: string) {
  return {
    environmentId,
    key: `api_plan_key_${suffix}`,
    name: `API Plan Key ${suffix}`,
    description: "Generated by the API testing plan runner",
    dataType: "text",
  };
}

function contactAttributeKeyUpdateBody(suffix: string) {
  return {
    name: `API Plan Key Updated ${suffix}`,
    description: "Updated by the API testing plan runner",
  };
}

function contactBody(environmentId: string, suffix: string) {
  return {
    environmentId,
    attributes: {
      email: `api-plan-${suffix}@example.com`,
      firstName: "API",
      lastName: "Plan",
      userId: `api_plan_${suffix}`,
    },
  };
}

function bulkContactsBody(environmentId: string, suffix: string) {
  return {
    environmentId,
    contacts: [
      {
        attributes: [
          { attributeKey: "email", value: `bulk-${suffix}-1@example.com` },
          { attributeKey: "firstName", value: "Bulk" },
        ],
      },
      {
        attributes: [
          { attributeKey: "email", value: `bulk-${suffix}-2@example.com` },
          { attributeKey: "firstName", value: "Runner" },
        ],
      },
    ],
  };
}

function storageBody(environmentId: string, suffix: string) {
  return {
    environmentId,
    fileName: `api-plan-${suffix}.png`,
    fileType: "image/png",
  };
}

async function runCase(
  logPath: string,
  results: CaseResult[],
  name: string,
  action: () => Promise<string[]>
): Promise<void> {
  const startedAt = Date.now();
  currentCaseTranscripts = [];

  try {
    if (READ_ONLY_MODE && MUTATING_CASE_PATTERN.test(name)) {
      throw new SkipCaseError(`Skipped in read-only mode: ${name}`);
    }

    const details = await action();
    const result: CaseResult = {
      name,
      status: "PASS",
      durationMs: Date.now() - startedAt,
      details,
      transcripts: [...currentCaseTranscripts],
    };
    results.push(result);
    await appendCase(logPath, result);
  } catch (error) {
    const result: CaseResult = {
      name,
      status: error instanceof SkipCaseError ? "SKIP" : "FAIL",
      durationMs: Date.now() - startedAt,
      details: [error instanceof Error ? error.message : String(error)],
      transcripts: [...currentCaseTranscripts],
    };
    results.push(result);
    await appendCase(logPath, result);
  }
}

async function createSurveyForKey(config: RunnerConfig, key: ParsedKey): Promise<string> {
  if (createdResources.surveys[key.alias]) {
    return createdResources.surveys[key.alias]!;
  }

  if (!isPermissionAllowed(key.permission, "POST")) {
    throw new SkipCaseError(`${key.alias} cannot create surveys because it only has ${key.permission} permission.`);
  }

  const scope = scopeFixture(config, key);
  const suffix = `${key.alias.toLowerCase()}_${Date.now()}`;
  const response = await httpRequest(config, key, "POST", "/api/v1/management/surveys", surveyCreateBody(scope.environmentId, suffix));
  const expectation = getExpectation(200, response.status, "Create survey");
  if (!expectation.ok) {
    throw new Error(`${expectation.message}. URL: ${response.url}`);
  }

  const createdId = getStringField(response.json, "id");
  if (!createdId) {
    throw new Error(`Create survey succeeded but no survey id was returned for ${key.alias}.`);
  }

  createdResources.surveys[key.alias] = createdId;
  return createdId;
}

async function runAuthAndGlobalChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  await runCase(logPath, results, "Global health endpoint returns 200", async () => {
    const response = await httpRequest(config, undefined, "GET", "/api/v2/health");
    const expectation = getExpectation(200, response.status, "GET /api/v2/health");
    if (!expectation.ok) {
      throw new Error(`${expectation.message}. URL: ${response.url}`);
    }

    return [`URL: \`${response.url}\``, `Expected: \`200\``, `Actual: \`${response.status}\``];
  });

  for (const alias of KEY_ALIASES) {
    const key = keys[alias];

    await runCase(logPath, results, `V1 auth succeeds for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", "/api/v1/auth");
      const expectation = getExpectation(200, response.status, "GET /api/v1/auth");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Key: \`${alias}\``, `Scope: \`${KEY_META[alias].label}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 management/me status matches expectation for ${alias}`, async () => {
      const expectedStatus = config.expectations?.v1ManagementMeStatusByKey?.[alias] ?? 200;
      const response = await httpRequest(config, key, "GET", "/api/v1/management/me");
      const expectation = getExpectation(expectedStatus, response.status, "GET /api/v1/management/me");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Key: \`${alias}\``, `Expected: \`${expectedStatus}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 roles succeeds for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", "/api/v2/roles");
      const expectation = getExpectation(200, response.status, "GET /api/v2/roles");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 me status matches expectation for ${alias}`, async () => {
      const expectedStatus = config.expectations?.v2MeStatusByKey?.[alias] ?? 401;
      const response = await httpRequest(config, key, "GET", "/api/v2/me");
      const expectation = getExpectation(expectedStatus, response.status, "GET /api/v2/me");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Key: \`${alias}\``, `Expected: \`${expectedStatus}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV1SurveyChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const foreign = foreignScopeFixture(config, key);

    await runCase(logPath, results, `V1 surveys list stays scoped for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", "/api/v1/management/surveys");
      const expectation = getExpectation(200, response.status, "GET /api/v1/management/surveys");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      const ids = extractItems(response.json).map((item) => String(item.id));
      if (!ids.includes(scope.surveyId)) {
        throw new Error(`Expected own survey ${scope.surveyId} to be visible for ${alias}.`);
      }
      if (ids.includes(foreign.surveyId)) {
        throw new Error(`Foreign survey ${foreign.surveyId} leaked into collection for ${alias}.`);
      }

      return [
        `Key: \`${alias}\``,
        `Own survey present: \`${scope.surveyId}\``,
        `Foreign survey absent: \`${foreign.surveyId}\``,
      ];
    });

    await runCase(logPath, results, `V1 surveys create own scope honors permissions for ${alias}`, async () => {
      const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v1/management/surveys",
        surveyCreateBody(scope.environmentId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v1/management/surveys");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 200) {
        const createdId = getStringField(response.json, "id");
        if (!createdId) {
          throw new Error(`Survey create for ${alias} returned 200 but no id.`);
        }
        createdResources.surveys[alias] = createdId;
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 surveys create blocks cross-workspace for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v1/management/surveys",
        surveyCreateBody(foreign.environmentId, `${alias.toLowerCase()}_foreign_${Date.now()}`)
      );
      const expectation = getExpectation(DEFAULT_V1_UNAUTHORIZED, response.status, "Cross-workspace survey create");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Key: \`${alias}\``, `Foreign environment: \`${foreign.environmentId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 survey GET own scope works for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", `/api/v1/management/surveys/${scope.surveyId}`);
      const expectation = getExpectation(200, response.status, "GET own v1 survey");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Survey: \`${scope.surveyId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 survey GET blocks cross-workspace for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", `/api/v1/management/surveys/${foreign.surveyId}`);
      const expectation = getExpectation(DEFAULT_V1_UNAUTHORIZED, response.status, "GET foreign v1 survey");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Foreign survey: \`${foreign.surveyId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 survey PUT own scope honors permissions for ${alias}`, async () => {
      const surveyId = createdResources.surveys[alias] ?? scope.surveyId;
      const expectedStatus = isPermissionAllowed(key.permission, "PUT") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(config, key, "PUT", `/api/v1/management/surveys/${surveyId}`, {
        name: `API Plan Updated Survey ${Date.now()}`,
      });
      const expectation = getExpectation(expectedStatus, response.status, "PUT own v1 survey");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Survey: \`${surveyId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 survey DELETE own scope honors permissions for ${alias}`, async () => {
      const surveyId = createdResources.surveys[alias] ?? scope.surveyId;
      const expectedStatus = isPermissionAllowed(key.permission, "DELETE") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(config, key, "DELETE", `/api/v1/management/surveys/${surveyId}`);
      const expectation = getExpectation(expectedStatus, response.status, "DELETE own v1 survey");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Survey: \`${surveyId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 survey singleUseIds works for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "GET",
        `/api/v1/management/surveys/${scope.surveyId}/singleUseIds`
      );
      const expectation = getExpectation(200, response.status, "GET /singleUseIds");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Survey: \`${scope.surveyId}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV1ResponseChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const foreign = foreignScopeFixture(config, key);

    await runCase(logPath, results, `V1 responses list stays scoped for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "GET",
        buildQuery("/api/v1/management/responses", { surveyId: scope.surveyId })
      );
      const expectation = getExpectation(200, response.status, "GET /api/v1/management/responses");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      const ids = extractItems(response.json).map((item) => String(item.id));
      if (!ids.includes(scope.responseId)) {
        throw new Error(`Expected own response ${scope.responseId} to be visible for ${alias}.`);
      }

      return [`Own response present: \`${scope.responseId}\``];
    });

    await runCase(logPath, results, `V1 responses create own scope honors permissions for ${alias}`, async () => {
      const surveyId = isPermissionAllowed(key.permission, "POST") ? await createSurveyForKey(config, key) : scope.surveyId;
      const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v1/management/responses",
        responseBody(surveyId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v1/management/responses");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 200) {
        const createdId = getStringField(response.json, "id");
        if (!createdId) {
          throw new Error(`Response create for ${alias} returned 200 but no id.`);
        }
        createdResources.responsesV1[alias] = createdId;
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 response GET own scope works for ${alias}`, async () => {
      const responseId = createdResources.responsesV1[alias] ?? scope.responseId;
      const response = await httpRequest(config, key, "GET", `/api/v1/management/responses/${responseId}`);
      const expectation = getExpectation(200, response.status, "GET own v1 response");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Response: \`${responseId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 response GET blocks cross-workspace for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", `/api/v1/management/responses/${foreign.responseId}`);
      const expectation = getExpectation(DEFAULT_V1_UNAUTHORIZED, response.status, "GET foreign v1 response");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Foreign response: \`${foreign.responseId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 response PUT own scope honors permissions for ${alias}`, async () => {
      const responseId = createdResources.responsesV1[alias] ?? scope.responseId;
      const expectedStatus = isPermissionAllowed(key.permission, "PUT") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(config, key, "PUT", `/api/v1/management/responses/${responseId}`, {
        finished: true,
        data: {},
        language: "en",
      });
      const expectation = getExpectation(expectedStatus, response.status, "PUT own v1 response");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Response: \`${responseId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 response DELETE own scope honors permissions for ${alias}`, async () => {
      const responseId = createdResources.responsesV1[alias] ?? scope.responseId;
      const expectedStatus = isPermissionAllowed(key.permission, "DELETE") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(config, key, "DELETE", `/api/v1/management/responses/${responseId}`);
      const expectation = getExpectation(expectedStatus, response.status, "DELETE own v1 response");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Response: \`${responseId}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV1ActionClassChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const foreign = foreignScopeFixture(config, key);

    await runCase(logPath, results, `V1 action classes list stays scoped for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", "/api/v1/management/action-classes");
      const expectation = getExpectation(200, response.status, "GET /api/v1/management/action-classes");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      const ids = extractItems(response.json).map((item) => String(item.id));
      if (!ids.includes(scope.actionClassId)) {
        throw new Error(`Expected own action class ${scope.actionClassId} to be visible for ${alias}.`);
      }
      if (ids.includes(foreign.actionClassId)) {
        throw new Error(`Foreign action class ${foreign.actionClassId} leaked into collection for ${alias}.`);
      }

      return [`Own action class present: \`${scope.actionClassId}\``, `Foreign absent: \`${foreign.actionClassId}\``];
    });

    await runCase(logPath, results, `V1 action classes create own scope honors permissions for ${alias}`, async () => {
      const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v1/management/action-classes",
        actionClassBody(scope.environmentId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v1/management/action-classes");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 200) {
        const createdId = getStringField(response.json, "id");
        if (!createdId) {
          throw new Error(`Action class create for ${alias} returned 200 but no id.`);
        }
        createdResources.actionClasses[alias] = createdId;
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 action class GET own scope works for ${alias}`, async () => {
      const actionClassId = createdResources.actionClasses[alias] ?? scope.actionClassId;
      const response = await httpRequest(config, key, "GET", `/api/v1/management/action-classes/${actionClassId}`);
      const expectation = getExpectation(200, response.status, "GET own v1 action class");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Action class: \`${actionClassId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 action class GET blocks cross-workspace for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "GET",
        `/api/v1/management/action-classes/${foreign.actionClassId}`
      );
      const expectation = getExpectation(DEFAULT_V1_UNAUTHORIZED, response.status, "GET foreign v1 action class");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Foreign action class: \`${foreign.actionClassId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 action class PUT own scope honors permissions for ${alias}`, async () => {
      const actionClassId = createdResources.actionClasses[alias] ?? scope.actionClassId;
      const expectedStatus = isPermissionAllowed(key.permission, "PUT") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(config, key, "PUT", `/api/v1/management/action-classes/${actionClassId}`, {
        ...actionClassBody(scope.environmentId, `${alias.toLowerCase()}_update_${Date.now()}`),
      });
      const expectation = getExpectation(expectedStatus, response.status, "PUT own v1 action class");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Action class: \`${actionClassId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 action class DELETE own scope honors permissions for ${alias}`, async () => {
      const actionClassId = createdResources.actionClasses[alias] ?? scope.actionClassId;
      const expectedStatus = isPermissionAllowed(key.permission, "DELETE") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(config, key, "DELETE", `/api/v1/management/action-classes/${actionClassId}`);
      const expectation = getExpectation(expectedStatus, response.status, "DELETE own v1 action class");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Action class: \`${actionClassId}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV1WebhookChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const foreign = foreignScopeFixture(config, key);

    await runCase(logPath, results, `V1 webhooks list stays scoped for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", "/api/v1/webhooks");
      const expectation = getExpectation(200, response.status, "GET /api/v1/webhooks");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      const ids = extractItems(response.json).map((item) => String(item.id));
      if (!ids.includes(scope.webhookId)) {
        throw new Error(`Expected own webhook ${scope.webhookId} to be visible for ${alias}.`);
      }
      if (ids.includes(foreign.webhookId)) {
        throw new Error(`Foreign webhook ${foreign.webhookId} leaked into collection for ${alias}.`);
      }

      return [`Own webhook present: \`${scope.webhookId}\``, `Foreign absent: \`${foreign.webhookId}\``];
    });

    await runCase(logPath, results, `V1 webhooks create own scope honors permissions for ${alias}`, async () => {
      const surveyId = createdResources.surveys[alias] ?? scope.surveyId;
      const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v1/webhooks",
        webhookBody(scope.environmentId, surveyId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v1/webhooks");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 200) {
        const createdId = getStringField(response.json, "id");
        if (!createdId) {
          throw new Error(`Webhook create for ${alias} returned 200 but no id.`);
        }
        createdResources.webhooksV1[alias] = createdId;
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 webhook GET own scope works for ${alias}`, async () => {
      const webhookId = createdResources.webhooksV1[alias] ?? scope.webhookId;
      const response = await httpRequest(config, key, "GET", `/api/v1/webhooks/${webhookId}`);
      const expectation = getExpectation(200, response.status, "GET own v1 webhook");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Webhook: \`${webhookId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 webhook DELETE own scope honors permissions for ${alias}`, async () => {
      const webhookId = createdResources.webhooksV1[alias] ?? scope.webhookId;
      const expectedStatus = isPermissionAllowed(key.permission, "DELETE") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(config, key, "DELETE", `/api/v1/webhooks/${webhookId}`);
      const expectation = getExpectation(expectedStatus, response.status, "DELETE own v1 webhook");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Webhook: \`${webhookId}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV1StorageChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  if (!config.features?.storage) {
    await runCase(logPath, results, "V1 storage checks", async () => {
      throw new SkipCaseError("Storage checks are disabled in api-testing-plan.config.json.");
    });
    return;
  }

  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 200 : DEFAULT_V1_UNAUTHORIZED;

    await runCase(logPath, results, `V1 storage signed upload honors permissions for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v1/management/storage",
        storageBody(scope.environmentId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v1/management/storage");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runOptionalContactChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  if (!config.features?.eeContacts) {
    await runCase(logPath, results, "EE contact checks", async () => {
      throw new SkipCaseError("EE contact checks are disabled in api-testing-plan.config.json.");
    });
    return;
  }

  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const foreign = foreignScopeFixture(config, key);

    await runCase(logPath, results, `V1 contacts list stays scoped for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", "/api/v1/management/contacts");
      const expectation = getExpectation([200, 403], response.status, "GET /api/v1/management/contacts");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 403) {
        throw new SkipCaseError("EE contacts appear to be disabled in the target app.");
      }

      const ids = extractItems(response.json).map((item) => String(item.id));
      if (!ids.includes(scope.contactId!)) {
        throw new Error(`Expected own contact ${scope.contactId} to be visible for ${alias}.`);
      }
      if (ids.includes(foreign.contactId!)) {
        throw new Error(`Foreign contact ${foreign.contactId} leaked into collection for ${alias}.`);
      }

      return [`Own contact present: \`${scope.contactId}\``, `Foreign absent: \`${foreign.contactId}\``];
    });

    await runCase(logPath, results, `V1 contact GET own scope works for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", `/api/v1/management/contacts/${scope.contactId}`);
      const expectation = getExpectation(200, response.status, "GET own v1 contact");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Contact: \`${scope.contactId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 contact DELETE own scope honors permissions for ${alias}`, async () => {
      let contactId = createdResources.contactsV2[alias];
      if (!contactId && isPermissionAllowed(key.permission, "POST")) {
        const created = await httpRequest(
          config,
          key,
          "POST",
          "/api/v2/management/contacts",
          contactBody(scope.environmentId, `${alias.toLowerCase()}_${Date.now()}`)
        );
        const createExpectation = getExpectation(201, created.status, "Seed contact via v2");
        if (!createExpectation.ok) {
          throw new Error(`${createExpectation.message}. URL: ${created.url}`);
        }
        contactId = getStringField(created.json, "id");
        if (!contactId) {
          throw new Error(`Seed contact for ${alias} returned 201 but no id.`);
        }
        createdResources.contactsV2[alias] = contactId;
      }

      contactId ??= scope.contactId;

      const expectedStatus = isPermissionAllowed(key.permission, "DELETE") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(config, key, "DELETE", `/api/v1/management/contacts/${contactId}`);
      const expectation = getExpectation(expectedStatus, response.status, "DELETE own v1 contact");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Contact: \`${contactId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V1 contact attribute keys list stays scoped for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", "/api/v1/management/contact-attribute-keys");
      const expectation = getExpectation(200, response.status, "GET /api/v1/management/contact-attribute-keys");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      const ids = extractItems(response.json).map((item) => String(item.id));
      if (!ids.includes(scope.contactAttributeKeyId!)) {
        throw new Error(`Expected own contact attribute key ${scope.contactAttributeKeyId} to be visible for ${alias}.`);
      }
      if (ids.includes(foreign.contactAttributeKeyId!)) {
        throw new Error(`Foreign contact attribute key ${foreign.contactAttributeKeyId} leaked into collection for ${alias}.`);
      }

      return [
        `Own contact attribute key present: \`${scope.contactAttributeKeyId}\``,
        `Foreign absent: \`${foreign.contactAttributeKeyId}\``,
      ];
    });

    await runCase(logPath, results, `V1 contact attribute key create own scope honors permissions for ${alias}`, async () => {
      const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 200 : DEFAULT_V1_UNAUTHORIZED;
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v1/management/contact-attribute-keys",
        contactAttributeKeyV1Body(scope.environmentId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v1/management/contact-attribute-keys");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 200) {
        const createdId = getStringField(response.json, "id");
        if (!createdId) {
          throw new Error(`V1 contact attribute key create for ${alias} returned 200 but no id.`);
        }
        createdResources.contactAttributeKeysV1[alias] = createdId;
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV2ResponseChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const foreign = foreignScopeFixture(config, key);

    await runCase(logPath, results, `V2 responses list stays scoped for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "GET",
        buildQuery("/api/v2/management/responses", { surveyId: scope.surveyId })
      );
      const expectation = getExpectation(200, response.status, "GET /api/v2/management/responses");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Expected visible response: \`${scope.responseId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 responses create own scope honors permissions for ${alias}`, async () => {
      const surveyId = isPermissionAllowed(key.permission, "POST") ? await createSurveyForKey(config, key) : scope.surveyId;
      const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 201 : DEFAULT_V2_UNAUTHORIZED;
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v2/management/responses",
        responseBody(surveyId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v2/management/responses");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 201) {
        const createdId = getStringField(response.json, "id");
        if (!createdId) {
          throw new Error(`V2 response create for ${alias} returned 201 but no id.`);
        }
        createdResources.responsesV2[alias] = createdId;
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 response GET own scope works for ${alias}`, async () => {
      const responseId = createdResources.responsesV2[alias] ?? scope.responseId;
      const response = await httpRequest(config, key, "GET", `/api/v2/management/responses/${responseId}`);
      const expectation = getExpectation(200, response.status, "GET own v2 response");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Response: \`${responseId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 response GET blocks cross-workspace for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", `/api/v2/management/responses/${foreign.responseId}`);
      const expectation = getExpectation(DEFAULT_V2_UNAUTHORIZED, response.status, "GET foreign v2 response");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Foreign response: \`${foreign.responseId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 response PUT own scope honors permissions for ${alias}`, async () => {
      const responseId = createdResources.responsesV2[alias] ?? scope.responseId;
      const expectedStatus = isPermissionAllowed(key.permission, "PUT") ? 200 : DEFAULT_V2_UNAUTHORIZED;
      const response = await httpRequest(config, key, "PUT", `/api/v2/management/responses/${responseId}`, {
        finished: true,
        data: {},
        language: "en",
      });
      const expectation = getExpectation(expectedStatus, response.status, "PUT own v2 response");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Response: \`${responseId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 response DELETE own scope honors permissions for ${alias}`, async () => {
      const responseId = createdResources.responsesV2[alias] ?? scope.responseId;
      const expectedStatus = isPermissionAllowed(key.permission, "DELETE") ? 200 : DEFAULT_V2_UNAUTHORIZED;
      const response = await httpRequest(config, key, "DELETE", `/api/v2/management/responses/${responseId}`);
      const expectation = getExpectation(expectedStatus, response.status, "DELETE own v2 response");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Response: \`${responseId}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV2WebhookChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const foreign = foreignScopeFixture(config, key);

    await runCase(logPath, results, `V2 webhooks list stays scoped for ${alias}`, async () => {
      const response = await httpRequest(config, key, "GET", "/api/v2/management/webhooks");
      const expectation = getExpectation(200, response.status, "GET /api/v2/management/webhooks");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      const ids = extractItems(response.json).map((item) => String(item.id));
      if (!ids.includes(scope.webhookId)) {
        throw new Error(`Expected own webhook ${scope.webhookId} to be visible for ${alias}.`);
      }
      if (ids.includes(foreign.webhookId)) {
        throw new Error(`Foreign webhook ${foreign.webhookId} leaked into collection for ${alias}.`);
      }

      return [`Own webhook present: \`${scope.webhookId}\``, `Foreign absent: \`${foreign.webhookId}\``];
    });

    await runCase(logPath, results, `V2 webhooks create own scope honors permissions for ${alias}`, async () => {
      const surveyId = createdResources.surveys[alias] ?? scope.surveyId;
      const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 201 : [401, 403];
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v2/management/webhooks",
        webhookBody(scope.environmentId, surveyId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v2/management/webhooks");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 201) {
        const createdId = getStringField(response.json, "id");
        if (!createdId) {
          throw new Error(`V2 webhook create for ${alias} returned 201 but no id.`);
        }
        createdResources.webhooksV2[alias] = createdId;
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 webhook GET own scope works for ${alias}`, async () => {
      const webhookId = createdResources.webhooksV2[alias] ?? scope.webhookId;
      const response = await httpRequest(config, key, "GET", `/api/v2/management/webhooks/${webhookId}`);
      const expectation = getExpectation(200, response.status, "GET own v2 webhook");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Webhook: \`${webhookId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 webhook PUT own scope honors permissions for ${alias}`, async () => {
      const webhookId = createdResources.webhooksV2[alias] ?? scope.webhookId;
      const surveyId = createdResources.surveys[alias] ?? scope.surveyId;
      const expectedStatus = isPermissionAllowed(key.permission, "PUT") ? 200 : DEFAULT_V2_UNAUTHORIZED;
      const response = await httpRequest(
        config,
        key,
        "PUT",
        `/api/v2/management/webhooks/${webhookId}`,
        webhookBody(scope.environmentId, surveyId, `${alias.toLowerCase()}_update_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "PUT own v2 webhook");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Webhook: \`${webhookId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 webhook DELETE own scope honors permissions for ${alias}`, async () => {
      const webhookId = createdResources.webhooksV2[alias] ?? scope.webhookId;
      const expectedStatus = isPermissionAllowed(key.permission, "DELETE") ? 200 : DEFAULT_V2_UNAUTHORIZED;
      const response = await httpRequest(config, key, "DELETE", `/api/v2/management/webhooks/${webhookId}`);
      const expectation = getExpectation(expectedStatus, response.status, "DELETE own v2 webhook");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Webhook: \`${webhookId}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV2ContactAttributeKeyChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  if (!config.features?.eeContacts) {
    await runCase(logPath, results, "V2 contact attribute key checks", async () => {
      throw new SkipCaseError("EE contact checks are disabled in api-testing-plan.config.json.");
    });
    return;
  }

  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const foreign = foreignScopeFixture(config, key);

    await runCase(logPath, results, `V2 contact attribute keys list stays scoped for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "GET",
        buildQuery("/api/v2/management/contact-attribute-keys", { environmentId: scope.environmentId })
      );
      const expectation = getExpectation(200, response.status, "GET /api/v2/management/contact-attribute-keys");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      const ids = extractItems(response.json).map((item) => String(item.id));
      if (!ids.includes(scope.contactAttributeKeyId!)) {
        throw new Error(`Expected own contact attribute key ${scope.contactAttributeKeyId} to be visible for ${alias}.`);
      }
      if (ids.includes(foreign.contactAttributeKeyId!)) {
        throw new Error(`Foreign contact attribute key ${foreign.contactAttributeKeyId} leaked into collection for ${alias}.`);
      }

      return [
        `Own contact attribute key present: \`${scope.contactAttributeKeyId}\``,
        `Foreign absent: \`${foreign.contactAttributeKeyId}\``,
      ];
    });

    await runCase(logPath, results, `V2 contact attribute key create own scope honors permissions for ${alias}`, async () => {
      const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 201 : [401, 403];
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v2/management/contact-attribute-keys",
        contactAttributeKeyV2Body(scope.environmentId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v2/management/contact-attribute-keys");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 201) {
        const createdId = getStringField(response.json, "id");
        if (!createdId) {
          throw new Error(`V2 contact attribute key create for ${alias} returned 201 but no id.`);
        }
        createdResources.contactAttributeKeysV2[alias] = createdId;
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 contact attribute key GET own scope works for ${alias}`, async () => {
      const contactAttributeKeyId = createdResources.contactAttributeKeysV2[alias] ?? scope.contactAttributeKeyId!;
      const response = await httpRequest(
        config,
        key,
        "GET",
        `/api/v2/management/contact-attribute-keys/${contactAttributeKeyId}`
      );
      const expectation = getExpectation(200, response.status, "GET own v2 contact attribute key");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Contact attribute key: \`${contactAttributeKeyId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 contact attribute key PUT own scope honors permissions for ${alias}`, async () => {
      const contactAttributeKeyId = createdResources.contactAttributeKeysV2[alias] ?? scope.contactAttributeKeyId!;
      const expectedStatus = isPermissionAllowed(key.permission, "PUT") ? 200 : DEFAULT_V2_UNAUTHORIZED;
      const response = await httpRequest(
        config,
        key,
        "PUT",
        `/api/v2/management/contact-attribute-keys/${contactAttributeKeyId}`,
        contactAttributeKeyUpdateBody(`${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "PUT own v2 contact attribute key");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Contact attribute key: \`${contactAttributeKeyId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 contact attribute key DELETE own scope honors permissions for ${alias}`, async () => {
      const contactAttributeKeyId = createdResources.contactAttributeKeysV2[alias] ?? scope.contactAttributeKeyId!;
      const expectedStatus = isPermissionAllowed(key.permission, "DELETE") ? 200 : DEFAULT_V2_UNAUTHORIZED;
      const response = await httpRequest(
        config,
        key,
        "DELETE",
        `/api/v2/management/contact-attribute-keys/${contactAttributeKeyId}`
      );
      const expectation = getExpectation(expectedStatus, response.status, "DELETE own v2 contact attribute key");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Contact attribute key: \`${contactAttributeKeyId}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV2ContactChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  if (!config.features?.eeContacts) {
    await runCase(logPath, results, "V2 contact checks", async () => {
      throw new SkipCaseError("EE contact checks are disabled in api-testing-plan.config.json.");
    });
    return;
  }

  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const expectedStatus = isPermissionAllowed(key.permission, "POST") ? 201 : [401, 403];

    await runCase(logPath, results, `V2 contacts create own scope honors permissions for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "POST",
        "/api/v2/management/contacts",
        contactBody(scope.environmentId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(expectedStatus, response.status, "POST /api/v2/management/contacts");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      if (response.status === 201) {
        const createdId = getStringField(response.json, "id");
        if (createdId) {
          createdResources.contactsV2[alias] = createdId;
        }
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 contacts bulk own scope honors permissions for ${alias}`, async () => {
      const bulkExpectedStatus = isPermissionAllowed(key.permission, "PUT") ? [200, 207] : [401, 403];
      const response = await httpRequest(
        config,
        key,
        "PUT",
        "/api/v2/management/contacts/bulk",
        bulkContactsBody(scope.environmentId, `${alias.toLowerCase()}_${Date.now()}`)
      );
      const expectation = getExpectation(bulkExpectedStatus, response.status, "PUT /api/v2/management/contacts/bulk");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Key: \`${alias}\``, `Actual: \`${response.status}\``];
    });
  }
}

async function runV2ContactLinkChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  if (!config.features?.eeContacts) {
    await runCase(logPath, results, "V2 survey contact-link checks", async () => {
      throw new SkipCaseError("EE contact checks are disabled in api-testing-plan.config.json.");
    });
    return;
  }

  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const scope = scopeFixture(config, key);
    const foreign = foreignScopeFixture(config, key);

    await runCase(logPath, results, `V2 survey contact-link by contact works for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "GET",
        `/api/v2/management/surveys/${scope.surveyId}/contact-links/contacts/${scope.contactId}`
      );
      const expectation = getExpectation(200, response.status, "GET contact-link by contact");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Survey: \`${scope.surveyId}\``, `Contact: \`${scope.contactId}\``];
    });

    await runCase(logPath, results, `V2 survey contact-link by contact blocks cross-workspace for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "GET",
        `/api/v2/management/surveys/${foreign.surveyId}/contact-links/contacts/${foreign.contactId}`
      );
      const expectation = getExpectation(DEFAULT_V2_UNAUTHORIZED, response.status, "GET foreign contact-link by contact");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Foreign survey: \`${foreign.surveyId}\``, `Actual: \`${response.status}\``];
    });

    await runCase(logPath, results, `V2 survey contact-link by segment works for ${alias}`, async () => {
      const response = await httpRequest(
        config,
        key,
        "GET",
        `/api/v2/management/surveys/${scope.surveyId}/contact-links/segments/${scope.segmentId}`
      );
      const expectation = getExpectation(200, response.status, "GET contact-link by segment");
      if (!expectation.ok) {
        throw new Error(`${expectation.message}. URL: ${response.url}`);
      }

      return [`Survey: \`${scope.surveyId}\``, `Segment: \`${scope.segmentId}\``];
    });
  }
}

async function runV3SurveyChecks(
  config: RunnerConfig,
  keys: Record<KeyAlias, ParsedKey>,
  logPath: string,
  results: CaseResult[]
) {
  for (const alias of KEY_ALIASES) {
    const key = keys[alias];
    const ownScope = scopeFixture(config, key);

    for (const workspaceScopeId of Object.keys(config.scopes) as ScopeId[]) {
      const workspace = ensureScope(config, workspaceScopeId);
      const expectedStatus = workspaceScopeId === key.scopeId ? 200 : DEFAULT_V3_UNAUTHORIZED;

      await runCase(logPath, results, `V3 surveys workspace access for ${alias} -> ${workspaceScopeId}`, async () => {
        const response = await httpRequest(
          config,
          key,
          "GET",
          buildQuery("/api/v3/surveys", { workspaceId: workspace.workspaceId })
        );
        const expectation = getExpectation(expectedStatus, response.status, "GET /api/v3/surveys");
        if (!expectation.ok) {
          throw new Error(`${expectation.message}. URL: ${response.url}`);
        }

        if (response.status === 200 && !response.headers.get("X-Request-Id")) {
          throw new Error(`Expected X-Request-Id header on successful v3 survey response for ${alias}.`);
        }

        return [
          `Requested workspace: \`${workspace.workspaceId}\``,
          `Own workspace: \`${ownScope.workspaceId}\``,
          `Actual: \`${response.status}\``,
          `X-Request-Id: \`${response.headers.get("X-Request-Id") ?? "missing"}\``,
        ];
      });
    }
  }
}

async function appendSummary(logPath: string, results: CaseResult[]) {
  const passCount = results.filter((result) => result.status === "PASS").length;
  const failCount = results.filter((result) => result.status === "FAIL").length;
  const skipCount = results.filter((result) => result.status === "SKIP").length;
  const summary = [
    "## Summary",
    `- Passed: ${passCount}`,
    `- Failed: ${failCount}`,
    `- Skipped: ${skipCount}`,
    "",
  ].join("\n");
  await appendFile(logPath, summary, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  READ_ONLY_MODE = args.readOnly;
  const configPath = path.resolve(process.cwd(), args.configPath);
  const config = await loadJsonConfig(configPath);
  validateConfig(config);

  const planPath = path.resolve(process.cwd(), config.planPath ?? "API Testing plan.md");
  const keys = await loadKeysFromPlan(planPath);

  const outputPath = path.resolve(
    process.cwd(),
    args.outputPath ?? `reports/api-testing-plan/run-${sanitizeFileTimestamp(new Date())}.md`
  );

  config.timeouts = {
    ...DEFAULT_TIMEOUTS,
    ...config.timeouts,
  };

  await createLogFile(outputPath, configPath, config, planPath);
  await ensureHealthy(config, outputPath);

  const results: CaseResult[] = [];

  await runAuthAndGlobalChecks(config, keys, outputPath, results);
  await runV1SurveyChecks(config, keys, outputPath, results);
  await runV1ResponseChecks(config, keys, outputPath, results);
  await runV1ActionClassChecks(config, keys, outputPath, results);
  await runV1WebhookChecks(config, keys, outputPath, results);
  await runV1StorageChecks(config, keys, outputPath, results);
  await runOptionalContactChecks(config, keys, outputPath, results);
  await runV2ResponseChecks(config, keys, outputPath, results);
  await runV2WebhookChecks(config, keys, outputPath, results);
  await runV2ContactAttributeKeyChecks(config, keys, outputPath, results);
  await runV2ContactChecks(config, keys, outputPath, results);
  await runV2ContactLinkChecks(config, keys, outputPath, results);
  await runV3SurveyChecks(config, keys, outputPath, results);
  await appendSummary(outputPath, results);

  const failCount = results.filter((result) => result.status === "FAIL").length;
  process.stdout.write(`API testing plan run complete. Log: ${outputPath}\n`);
  process.exitCode = failCount > 0 ? 1 : 0;
}

void main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
