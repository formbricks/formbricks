import { Client } from "pg";

export type OnlineIndex = Readonly<{
  name: string;
  table: string;
  columns: readonly string[];
  unique?: boolean;
  predicate?: string;
}>;

export const ONLINE_INDEXES: readonly OnlineIndex[] = [
  { name: "Response_created_at_id_idx", table: "Response", columns: ["created_at", "id"] },
  {
    name: "Response_surveyId_created_at_id_idx",
    table: "Response",
    columns: ["surveyId", "created_at", "id"],
  },
  {
    name: "Response_contactId_created_at_id_idx",
    table: "Response",
    columns: ["contactId", "created_at", "id"],
  },
  { name: "User_isBootstrapAdmin_key", table: "User", columns: ["isBootstrapAdmin"], unique: true },
  { name: "Survey_workspaceId_ownerId_idx", table: "Survey", columns: ["workspaceId", "ownerId"] },
  {
    name: "Survey_visibility_pending_idx",
    table: "Survey",
    columns: ["workspaceId"],
    predicate: "visibilityPending",
  },
];

const quote = (identifier: string): string => `"${identifier.replaceAll('"', '""')}"`;
const readIndex = async (client: Client, index: OnlineIndex) => {
  const { rows } = await client.query<{
    valid: boolean;
    simple: boolean;
    unique: boolean;
    table: string;
    columns: string[];
    predicate: string | null;
  }>(
    `
    SELECT x.indisvalid AS valid, x.indisunique AS unique, t.relname AS table,
      (x.indexprs IS NULL AND x.indnkeyatts = x.indnatts AND NOT x.indnullsnotdistinct
       AND am.amname = 'btree' AND NOT EXISTS (SELECT 1 FROM unnest(x.indoption) AS opt WHERE opt <> 0)) AS simple,
      ARRAY(SELECT a.attname::text FROM unnest(x.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum ORDER BY ord) AS columns,
      pg_get_expr(x.indpred, x.indrelid) AS predicate
    FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_am am ON am.oid = i.relam
    WHERE i.relnamespace = current_schema()::regnamespace AND i.relname = $1`,
    [index.name]
  );
  const row = rows.length > 0 ? rows[0] : undefined;
  if (
    row &&
    (!row.simple ||
      row.table !== index.table ||
      row.unique !== !!index.unique ||
      JSON.stringify(row.columns) !== JSON.stringify(index.columns) ||
      (row.predicate?.replaceAll('"', "") ?? null) !== (index.predicate ?? null))
  ) {
    throw new Error(`Unexpected definition for upgrade index ${index.name}`);
  }
  return row;
};

/** Autocommit statements on one connection: never CREATE/DROP CONCURRENTLY inside a transaction. */
export const ensureOnlineIndexes = async (databaseUrl: string): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    // Concurrent builds also wait for older writers and snapshots. A short DDL lock timeout
    // would cancel a healthy online build (ENG-3701); this dedicated connection is closed below.
    await client.query("SET lock_timeout = 0");
    for (const index of ONLINE_INDEXES) {
      const existing = await readIndex(client, index);
      if (existing?.valid) continue;
      if (existing) await client.query(`DROP INDEX CONCURRENTLY ${quote(index.name)}`);
      await client.query(
        `CREATE ${index.unique ? "UNIQUE " : ""}INDEX CONCURRENTLY ${quote(index.name)} ON ${quote(index.table)} (${index.columns.map(quote).join(", ")})${index.predicate ? ` WHERE ${quote(index.predicate)}` : ""}`
      );
      if (!(await readIndex(client, index))?.valid)
        throw new Error(`Upgrade index is not valid: ${index.name}`);
    }
  } finally {
    await client.end();
  }
};
