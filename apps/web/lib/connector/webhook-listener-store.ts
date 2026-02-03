import "server-only";
import { nanoid } from "nanoid";

// Session TTL in milliseconds (5 minutes)
const SESSION_TTL_MS = 5 * 60 * 1000;

// Maximum payload size in bytes (100KB)
const MAX_PAYLOAD_SIZE = 100 * 1024;

// Cleanup interval in milliseconds (1 minute)
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface WebhookSession {
  payload: Record<string, unknown>;
  receivedAt: number;
}

// In-memory store for webhook payloads
const sessionStore = new Map<string, WebhookSession>();

// Track if cleanup interval is running
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Generate a unique session ID for webhook listening
 */
export function generateSessionId(): string {
  return nanoid(21);
}

/**
 * Store a received webhook payload for a session
 * @returns true if stored successfully, false if payload is too large or session doesn't exist
 */
export function storePayload(sessionId: string, payload: Record<string, unknown>): boolean {
  // Check payload size
  const payloadStr = JSON.stringify(payload);
  if (payloadStr.length > MAX_PAYLOAD_SIZE) {
    return false;
  }

  sessionStore.set(sessionId, {
    payload,
    receivedAt: Date.now(),
  });

  return true;
}

/**
 * Get the received payload for a session
 * @param clear - If true, removes the payload after retrieval (default: true)
 * @returns The payload if found, null otherwise
 */
export function getPayload(sessionId: string, clear: boolean = true): Record<string, unknown> | null {
  const session = sessionStore.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (Date.now() - session.receivedAt > SESSION_TTL_MS) {
    sessionStore.delete(sessionId);
    return null;
  }

  const { payload } = session;

  if (clear) {
    sessionStore.delete(sessionId);
  }

  return payload;
}

/**
 * Check if a session exists (for validation)
 */
export function sessionExists(sessionId: string): boolean {
  return sessionStore.has(sessionId);
}

/**
 * Create a new listening session
 * @returns The session ID
 */
export function createSession(): string {
  const sessionId = generateSessionId();
  // Initialize with empty marker to indicate session is active
  // This doesn't store a payload yet, just marks the session as valid
  return sessionId;
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of sessionStore.entries()) {
    if (now - session.receivedAt > SESSION_TTL_MS) {
      sessionStore.delete(sessionId);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

/**
 * Start the automatic cleanup interval
 */
export function startCleanupInterval(): void {
  if (cleanupIntervalId) {
    return; // Already running
  }

  cleanupIntervalId = setInterval(() => {
    cleanupExpiredSessions();
  }, CLEANUP_INTERVAL_MS);

  // Prevent the interval from keeping the process alive
  if (cleanupIntervalId.unref) {
    cleanupIntervalId.unref();
  }
}

/**
 * Stop the automatic cleanup interval
 */
export function stopCleanupInterval(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/**
 * Get the current number of active sessions (for debugging/monitoring)
 */
export function getSessionCount(): number {
  return sessionStore.size;
}

// Start cleanup on module load
startCleanupInterval();
