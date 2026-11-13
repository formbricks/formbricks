/**
 * Feedback records seeded straight into Formbricks Hub, for journeys that need chart data. CI starts
 * neither Hub nor Cube, so a spec that uses these first asks `isHubAndCubeReachable` and skips without
 * them — the same way storage-dependent specs skip without configured file storage.
 */

export interface HubRecord {
  tenant_id: string;
  submission_id: string;
  source_type: string;
  source_id?: string;
  source_name?: string;
  field_id: string;
  field_type: "text" | "categorical" | "nps" | "csat" | "ces" | "rating" | "number" | "boolean" | "date";
  field_label?: string;
  value_text?: string;
  value_number?: number;
  value_id?: string;
  collected_at?: string;
  metadata?: Record<string, unknown>;
}

const hubUrl = (): string | undefined => process.env.HUB_API_URL?.replace(/\/$/, "");
const cubeUrl = (): string | undefined => process.env.CUBEJS_API_URL?.replace(/\/$/, "");

const hubHeaders = (): Record<string, string> => ({
  "content-type": "application/json",
  authorization: `Bearer ${(process.env.HUB_API_KEY ?? "").replace(/^"|"$/g, "")}`,
});

const answers = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
};

/** Both services this app's charts read through are up: Hub stores the records, Cube queries them. */
export const isHubAndCubeReachable = async (): Promise<boolean> => {
  const hub = hubUrl();
  const cube = cubeUrl();
  if (!hub || !cube) return false;
  const [hubUp, cubeUp] = await Promise.all([answers(`${hub}/health`), answers(`${cube}/readyz`)]);
  return hubUp && cubeUp;
};

/** Create records through Hub's public API, a bounded number at a time. */
export const createHubRecords = async (records: readonly HubRecord[], concurrency = 24): Promise<void> => {
  const hub = hubUrl();
  if (!hub) throw new Error("HUB_API_URL is not set");
  let next = 0;
  const worker = async () => {
    while (next < records.length) {
      const record = records[next++];
      const response = await fetch(`${hub}/v1/feedback-records`, {
        method: "POST",
        headers: hubHeaders(),
        body: JSON.stringify(record),
      });
      if (!response.ok) {
        throw new Error(`Hub refused a record (${response.status}): ${await response.text()}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, records.length) }, worker));
};

/** Remove every record of a Feedback Dataset (Hub tenant). */
export const deleteHubTenant = async (tenantId: string): Promise<void> => {
  const hub = hubUrl();
  if (!hub) return;
  await fetch(`${hub}/v1/tenants/${encodeURIComponent(tenantId)}/feedback-records`, {
    method: "DELETE",
    headers: hubHeaders(),
  });
};
