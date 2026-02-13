import fs from "fs";
import path from "path";

/**
 * Query Configuration Loader
 *
 * Loads and manages query configurations from JSON file
 * Supports environment variable interpolation
 */

export interface QueryConfig {
  name: string;
  description?: string;
  database?: string;
  schema?: string;
  sql: string;
  parameters: string[];
  fields: Record<string, string>;
  cache?: {
    enabled: boolean;
    ttl?: number;
  };
}

export interface QueryConfigFile {
  version: string;
  queries: Record<string, QueryConfig>;
  security?: {
    allowCustomQueries?: boolean;
    maxQueryLength?: number;
    allowedStatements?: string[];
    blockedKeywords?: string[];
    requireWhereClause?: boolean;
    requireLimit?: boolean;
    maxRows?: number;
  };
  defaults?: {
    timeout?: number;
    cache?: {
      enabled: boolean;
      ttl: number;
    };
  };
}

let cachedConfig: QueryConfigFile | null = null;
let configLoadTime: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1 minute

/**
 * Load query configuration from JSON file
 * Caches result for 1 minute
 */
export function loadQueryConfig(): QueryConfigFile {
  const now = Date.now();

  // Return cached config if still valid
  if (cachedConfig && now - configLoadTime < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const configPath = path.join(process.cwd(), "apps/web/app/api/member-lookup/query-config.json");
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config: QueryConfigFile = JSON.parse(configContent);

    // Interpolate environment variables
    const interpolated = interpolateEnvVars(config);

    cachedConfig = interpolated;
    configLoadTime = now;

    console.log(`[Query Config] Loaded ${Object.keys(config.queries).length} query configurations`);

    return interpolated;
  } catch (error) {
    console.error("[Query Config] Failed to load configuration:", error);
    throw new Error("Failed to load query configuration");
  }
}

/**
 * Get specific query configuration by ID
 */
export function getQueryConfig(queryId: string): QueryConfig {
  const config = loadQueryConfig();

  if (!config.queries[queryId]) {
    throw new Error(
      `Query configuration not found: ${queryId}. Available: ${Object.keys(config.queries).join(", ")}`
    );
  }

  return config.queries[queryId];
}

/**
 * List all available query configurations
 */
export function listQueryConfigs(): Array<{ id: string; name: string; description?: string }> {
  const config = loadQueryConfig();

  return Object.entries(config.queries).map(([id, query]) => ({
    id,
    name: query.name,
    description: query.description,
  }));
}

/**
 * Validate query configuration
 */
export function validateQueryConfig(queryConfig: QueryConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  if (!queryConfig.sql) {
    errors.push("SQL query is required");
  }

  if (!queryConfig.parameters || queryConfig.parameters.length === 0) {
    errors.push("At least one parameter is required");
  }

  if (!queryConfig.fields || Object.keys(queryConfig.fields).length === 0) {
    errors.push("Field mappings are required");
  }

  // Security checks
  const config = loadQueryConfig();
  const security = config.security;

  if (security) {
    const sqlUpper = queryConfig.sql.toUpperCase();

    // Check blocked keywords
    if (security.blockedKeywords) {
      const blocked = security.blockedKeywords.find((keyword) => sqlUpper.includes(keyword));
      if (blocked) {
        errors.push(`Blocked keyword found: ${blocked}`);
      }
    }

    // Check allowed statements
    if (security.allowedStatements) {
      const hasAllowed = security.allowedStatements.some((stmt) => sqlUpper.trim().startsWith(stmt));
      if (!hasAllowed) {
        errors.push(`Query must start with one of: ${security.allowedStatements.join(", ")}`);
      }
    }

    // Check WHERE clause
    if (security.requireWhereClause && !sqlUpper.includes("WHERE")) {
      errors.push("Query must include WHERE clause");
    }

    // Check LIMIT clause
    if (security.requireLimit && !sqlUpper.includes("LIMIT")) {
      errors.push("Query must include LIMIT clause");
    }

    // Check query length
    if (security.maxQueryLength && queryConfig.sql.length > security.maxQueryLength) {
      errors.push(`Query exceeds maximum length of ${security.maxQueryLength}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Interpolate environment variables in config
 * Replaces {{ENV_VAR}} with process.env.ENV_VAR
 */
function interpolateEnvVars(config: QueryConfigFile): QueryConfigFile {
  const interpolated = JSON.parse(JSON.stringify(config));

  // Interpolate in queries
  Object.keys(interpolated.queries).forEach((queryId) => {
    const query = interpolated.queries[queryId];

    // Interpolate database
    if (query.database) {
      query.database = interpolateString(query.database);
    }

    // Interpolate schema
    if (query.schema) {
      query.schema = interpolateString(query.schema);
    }

    // Interpolate SQL (be careful with this!)
    // Only interpolate database/schema references, not actual values
    query.sql = interpolateString(query.sql);
  });

  return interpolated;
}

/**
 * Interpolate environment variables in a string
 * {{VAR_NAME}} -> process.env.VAR_NAME
 */
function interpolateString(str: string): string {
  return str.replace(/\{\{([A-Z_]+)\}\}/g, (match, varName) => {
    const value = process.env[varName];
    if (!value) {
      console.warn(`[Query Config] Environment variable not found: ${varName}`);
      return match; // Keep original if not found
    }
    return value;
  });
}

/**
 * Get full query configurations with all details (parameters, fields, etc.)
 * Used by the UI to auto-generate field mappings
 */
export function getFullQueryConfigs(): Array<{
  id: string;
  name: string;
  description?: string;
  sql: string;
  parameters: string[];
  fields: Record<string, string>;
  cache?: { enabled: boolean; ttl?: number };
}> {
  const config = loadQueryConfig();

  return Object.entries(config.queries).map(([id, query]) => ({
    id,
    name: query.name,
    description: query.description,
    sql: query.sql,
    parameters: query.parameters,
    fields: query.fields,
    cache: query.cache,
  }));
}

/**
 * Add a new query configuration to the config file
 */
export function addQueryConfig(id: string, queryConfig: QueryConfig): void {
  const configPath = path.join(process.cwd(), "apps/web/app/api/member-lookup/query-config.json");

  let configContent: string;
  let config: QueryConfigFile;

  try {
    configContent = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(configContent);
  } catch {
    config = { version: "1.0", queries: {} };
  }

  if (config.queries[id]) {
    throw new Error(`Query configuration already exists: ${id}`);
  }

  config.queries[id] = queryConfig;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  // Invalidate cache so the new query is available immediately
  cachedConfig = null;
  configLoadTime = 0;

  console.log(`[Query Config] Added new query configuration: ${id}`);
}

/**
 * Reload configuration (for hot-reloading in development)
 */
export function reloadQueryConfig(): void {
  cachedConfig = null;
  configLoadTime = 0;
  console.log("[Query Config] Configuration cache cleared");
}
