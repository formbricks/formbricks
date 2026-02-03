import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TCreateFeedbackRecordInput, createFeedbackRecordsBatch } from "@/lib/connector/hub-client";
import { getPayload, storePayload } from "@/lib/connector/webhook-listener-store";

// Maximum payload size in bytes (100KB)
const MAX_PAYLOAD_SIZE = 100 * 1024;

/**
 * POST /api/unify/webhook/[connectorId]
 *
 * Receive incoming webhook payloads for a connector.
 * - If connector has no field mappings yet: Store payload for setup UI
 * - If connector has field mappings: Process and send to Hub
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ connectorId: string }> }
): Promise<NextResponse> {
  const { connectorId } = await props.params;

  if (!connectorId) {
    return NextResponse.json({ error: "Connector ID required" }, { status: 400 });
  }

  try {
    // Check content length
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      return NextResponse.json({ error: "Payload too large. Maximum size is 100KB." }, { status: 413 });
    }

    // Parse the JSON payload
    let payload: Record<string, unknown>;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // Validate payload is an object
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Payload must be a JSON object" }, { status: 400 });
    }

    // Fetch connector with its field mappings
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      include: {
        fieldMappings: true,
      },
    });

    if (!connector) {
      return NextResponse.json({ error: "Connector not found" }, { status: 404 });
    }

    if (connector.type !== "webhook") {
      return NextResponse.json({ error: "This endpoint is only for webhook connectors" }, { status: 400 });
    }

    if (connector.status !== "active") {
      return NextResponse.json({ error: "Connector is not active" }, { status: 400 });
    }

    // Check if connector has field mappings configured
    const hasMappings = connector.fieldMappings && connector.fieldMappings.length > 0;

    if (!hasMappings) {
      // Setup phase: Store payload for UI to fetch
      const stored = storePayload(connectorId, payload);
      if (!stored) {
        return NextResponse.json({ error: "Failed to store payload. It may be too large." }, { status: 413 });
      }

      logger.info({ connectorId }, "Webhook payload stored for setup");
      return NextResponse.json(
        { success: true, message: "Payload received for setup", mode: "setup" },
        { status: 200 }
      );
    }

    // Production phase: Transform and send to Hub
    const feedbackRecords: TCreateFeedbackRecordInput[] = [];

    // Build a single feedback record from the payload using field mappings
    const record: Record<string, unknown> = {};

    for (const mapping of connector.fieldMappings) {
      let value: unknown;

      if (mapping.staticValue) {
        // Use static value
        value = mapping.staticValue;
        // Handle special static values
        if (value === "$now") {
          value = new Date().toISOString();
        }
      } else {
        // Get value from payload using dot notation path
        value = getNestedValue(payload, mapping.sourceFieldId);
      }

      if (value !== undefined && value !== null) {
        record[mapping.targetFieldId] = value;
      }
    }

    // Ensure required fields have defaults
    if (!record.source_type) {
      record.source_type = "webhook";
    }
    if (!record.collected_at) {
      record.collected_at = new Date().toISOString();
    }
    if (!record.field_type) {
      record.field_type = "text";
    }
    if (!record.field_id) {
      record.field_id = connectorId;
    }

    // Add environment as tenant
    record.tenant_id = connector.environmentId;

    feedbackRecords.push(record as TCreateFeedbackRecordInput);

    // Send to Hub
    const { results } = await createFeedbackRecordsBatch(feedbackRecords);

    const successCount = results.filter((r) => r.data && !r.error).length;
    const errorCount = results.filter((r) => r.error).length;

    if (errorCount > 0) {
      logger.error(
        { connectorId, errors: results.filter((r) => r.error).map((r) => r.error) },
        "Some feedback records failed to create"
      );
    }

    // Update connector last sync time
    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        lastSyncAt: new Date(),
        errorMessage: errorCount > 0 ? `${errorCount} records failed` : null,
      },
    });

    logger.info({ connectorId, successCount, errorCount }, "Webhook processed");

    return NextResponse.json(
      {
        success: true,
        message: "Webhook processed",
        mode: "production",
        records_created: successCount,
        records_failed: errorCount,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ error, connectorId }, "Error processing webhook");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/unify/webhook/[connectorId]
 *
 * Poll for a received webhook payload during setup phase.
 * Returns the stored payload if one exists.
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ connectorId: string }> }
): Promise<NextResponse> {
  const { connectorId } = await props.params;

  if (!connectorId) {
    return NextResponse.json({ error: "Connector ID required" }, { status: 400 });
  }

  try {
    // Verify connector exists
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      select: { id: true, type: true },
    });

    if (!connector) {
      return NextResponse.json({ error: "Connector not found" }, { status: 404 });
    }

    if (connector.type !== "webhook") {
      return NextResponse.json({ error: "This endpoint is only for webhook connectors" }, { status: 400 });
    }

    // Get the stored payload (and clear it)
    const payload = getPayload(connectorId, true);

    if (!payload) {
      // No payload received yet
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ payload }, { status: 200 });
  } catch (error) {
    logger.error({ error, connectorId }, "Error retrieving webhook payload");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * OPTIONS /api/unify/webhook/[connectorId]
 * Handle CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * Helper to get a nested value from an object using dot notation and array brackets
 * Supports paths like: "form_response.answers[0].text" or "data.items[2].name"
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  let current: unknown = obj;

  // Split by dots, but we need to handle array notation within each segment
  const segments = path.split(".");

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Check if segment contains array notation like "answers[0]" or just "[0]"
    const arrayMatch = segment.match(/^([^\[]*)\[(\d+)\]$/);

    if (arrayMatch) {
      const [, propertyName, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);

      // If there's a property name before the bracket, access it first
      if (propertyName) {
        if (typeof current !== "object") {
          return undefined;
        }
        current = (current as Record<string, unknown>)[propertyName];
      }

      // Now access the array index
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[index];
    } else {
      // Regular property access
      if (typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}
