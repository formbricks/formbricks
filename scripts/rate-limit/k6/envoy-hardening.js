import http from "k6/http";
import { Counter } from "k6/metrics";
import { sleep } from "k6";

const PROFILE = (__ENV.PROFILE || "smoke").toLowerCase();
const SCENARIO = (__ENV.SCENARIO || "public").toLowerCase();
const HOST = __ENV.HOST || "https://staging.app.formbricks.com";
const ENVIRONMENT_ID = __ENV.ENVIRONMENT_ID || "";
const API_KEY = __ENV.API_KEY || "";
const SLEEP_SECONDS = Number(__ENV.SLEEP_SECONDS || "0");

const totalResponses = new Counter("total_responses");
const status2xx = new Counter("status_2xx");
const status429 = new Counter("status_429");
const status5xx = new Counter("status_5xx");
const statusOther = new Counter("status_other");
const gatewayRoutedResponses = new Counter("gateway_routed_responses");
const gateway429s = new Counter("gateway_429s");
const app429s = new Counter("app_429s");
const unknown429s = new Counter("unknown_429s");

const profileDefaults = {
  smoke: {
    public: { executor: "per-vu-iterations", vus: 1, iterations: 3 },
    management: { executor: "per-vu-iterations", vus: 1, iterations: 3 },
    negative: { executor: "per-vu-iterations", vus: 1, iterations: 5 },
  },
  burst: {
    public: { executor: "per-vu-iterations", vus: 20, iterations: 7 },
    management: { executor: "per-vu-iterations", vus: 20, iterations: 6 },
    negative: { executor: "per-vu-iterations", vus: 10, iterations: 3 },
  },
  soak: {
    public: { executor: "constant-vus", vus: 10, duration: "5m" },
    management: { executor: "constant-vus", vus: 15, duration: "5m" },
    negative: { executor: "constant-vus", vus: 5, duration: "3m" },
  },
};

function requireValue(value, name, scenario) {
  if (!value) {
    throw new Error(`${name} is required for scenario "${scenario}"`);
  }
}

function getScenarioConfig(profile, scenario) {
  const profileConfig = profileDefaults[profile];
  if (!profileConfig) {
    throw new Error(`Unsupported PROFILE "${profile}". Use smoke, burst, or soak.`);
  }

  const scenarioConfig = profileConfig[scenario];
  if (!scenarioConfig) {
    throw new Error(`Unsupported SCENARIO "${scenario}". Use public, management, or negative.`);
  }

  return scenarioConfig;
}

function buildOptions() {
  const base = getScenarioConfig(PROFILE, SCENARIO);
  const scenarioConfig = {
    executor: base.executor,
    exec: "runScenario",
    gracefulStop: "0s",
    tags: {
      profile: PROFILE,
      scenario: SCENARIO,
    },
  };

  if (base.executor === "constant-vus") {
    scenarioConfig.vus = Number(__ENV.VUS || String(base.vus));
    scenarioConfig.duration = __ENV.DURATION || base.duration;
  } else {
    scenarioConfig.vus = Number(__ENV.VUS || String(base.vus));
    scenarioConfig.iterations = Number(__ENV.ITERATIONS || String(base.iterations));
    scenarioConfig.maxDuration = __ENV.MAX_DURATION || "10m";
  }

  return {
    scenarios: {
      envoy_hardening: scenarioConfig,
    },
  };
}

function getHeader(response, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(response.headers || {})) {
    if (key.toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return undefined;
}

function hasGatewayHeaders(response) {
  return [
    "x-envoy-ratelimited",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
  ].some((header) => Boolean(getHeader(response, header)));
}

function classifyResponse(response) {
  const body = typeof response.body === "string" ? response.body : "";
  if (body.includes('"code":"too_many_requests"')) {
    return "app";
  }

  if (hasGatewayHeaders(response)) {
    return "gateway";
  }

  if (response.status === 429 && body.trim().length === 0) {
    return "gateway";
  }

  return "unknown";
}

function buildRequest() {
  switch (SCENARIO) {
    case "public":
      requireValue(ENVIRONMENT_ID, "ENVIRONMENT_ID", SCENARIO);
      return {
        label: "GET /api/v1/client/{environmentId}/environment",
        method: "GET",
        url: `${HOST}/api/v1/client/${ENVIRONMENT_ID}/environment`,
        body: null,
        params: { timeout: "30s" },
      };
    case "management":
      requireValue(API_KEY, "API_KEY", SCENARIO);
      return {
        label: "GET /api/v1/management/me",
        method: "GET",
        url: `${HOST}/api/v1/management/me`,
        body: null,
        params: {
          timeout: "30s",
          headers: {
            "x-api-key": API_KEY,
          },
        },
      };
    case "negative":
      return {
        label: "GET /api/v2/health",
        method: "GET",
        url: `${HOST}/api/v2/health`,
        body: null,
        params: { timeout: "30s" },
      };
    default:
      throw new Error(`Unsupported SCENARIO "${SCENARIO}"`);
  }
}

function recordResponse(response) {
  totalResponses.add(1);

  if (response.status >= 200 && response.status < 300) {
    status2xx.add(1);
  } else if (response.status === 429) {
    status429.add(1);
  } else if (response.status >= 500) {
    status5xx.add(1);
  } else {
    statusOther.add(1);
  }

  const source = classifyResponse(response);
  if (source === "gateway") {
    gatewayRoutedResponses.add(1);
  }

  if (response.status === 429) {
    if (source === "gateway") {
      gateway429s.add(1);
    } else if (source === "app") {
      app429s.add(1);
    } else {
      unknown429s.add(1);
    }
  }
}

function metricCount(data, name) {
  return data.metrics[name]?.values?.count ?? 0;
}

function trendValue(data, name, key) {
  return data.metrics[name]?.values?.[key] ?? 0;
}

function evaluateRun(data) {
  const total429s = metricCount(data, "status_429");
  const gatewayTagged = metricCount(data, "gateway_routed_responses");
  const gatewayLimited = metricCount(data, "gateway_429s");
  const appLimited = metricCount(data, "app_429s");
  const errors5xx = metricCount(data, "status_5xx");
  const otherStatuses = metricCount(data, "status_other");

  if (SCENARIO === "negative") {
    return total429s === 0 && errors5xx === 0 && otherStatuses === 0;
  }

  if (PROFILE === "smoke") {
    return gatewayTagged > 0 && total429s === 0 && errors5xx === 0 && otherStatuses === 0;
  }

  if (PROFILE === "burst") {
    return gatewayLimited > 0 && appLimited === 0 && errors5xx === 0 && otherStatuses === 0;
  }

  return (
    gatewayTagged > 0 &&
    gatewayLimited > 0 &&
    appLimited === 0 &&
    errors5xx === 0 &&
    otherStatuses === 0
  );
}

function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}

export const options = buildOptions();

export function runScenario() {
  const request = buildRequest();
  const response = http.request(request.method, request.url, request.body, request.params);
  recordResponse(response);

  if (SLEEP_SECONDS > 0) {
    sleep(SLEEP_SECONDS);
  }
}

export function handleSummary(data) {
  const result = evaluateRun(data) ? "PASS" : "FAIL";
  const totalRequests = data.metrics.http_reqs?.values?.count ?? 0;
  const summary = [
    "=== Envoy Hardening Summary ===",
    `profile=${PROFILE}`,
    `scenario=${SCENARIO}`,
    `host=${HOST}`,
    `route=${buildRequest().label}`,
    `total_requests=${totalRequests}`,
    `status_2xx=${metricCount(data, "status_2xx")}`,
    `status_429=${metricCount(data, "status_429")}`,
    `status_5xx=${metricCount(data, "status_5xx")}`,
    `status_other=${metricCount(data, "status_other")}`,
    `gateway_routed_responses=${metricCount(data, "gateway_routed_responses")}`,
    `gateway_429s=${metricCount(data, "gateway_429s")}`,
    `app_429s=${metricCount(data, "app_429s")}`,
    `unknown_429s=${metricCount(data, "unknown_429s")}`,
    `http_req_duration_p95_ms=${formatNumber(trendValue(data, "http_req_duration", "p(95)"))}`,
    `http_req_duration_p99_ms=${formatNumber(trendValue(data, "http_req_duration", "p(99)"))}`,
    `iteration_duration_p95_ms=${formatNumber(trendValue(data, "iteration_duration", "p(95)"))}`,
    `result=${result}`,
  ];

  return {
    stdout: `${summary.join("\n")}\n`,
  };
}
