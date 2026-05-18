import type { Queue, Worker } from "bullmq";
import type IORedis from "ioredis";
import { vi } from "vitest";

type TLoggerMethod = ReturnType<typeof vi.fn<(context: unknown, message?: string) => void>>;
type TConnectionOnMethod = ReturnType<
  typeof vi.fn<(event: string, handler: (...args: unknown[]) => void) => void>
>;
type TAsyncVoidMethod = ReturnType<typeof vi.fn<() => Promise<void>>>;
type TQueueAddMethod = ReturnType<
  typeof vi.fn<(name: string, data: unknown, options?: unknown) => Promise<unknown>>
>;
type TQueueScheduleMethod = ReturnType<
  typeof vi.fn<(jobId: string, schedule: unknown, template: unknown) => Promise<unknown>>
>;
type TQueueRemoveSchedulerMethod = ReturnType<typeof vi.fn<(jobId: string) => Promise<boolean>>>;
type TWorkerOnMethod = ReturnType<
  typeof vi.fn<(event: string, handler: (...args: unknown[]) => void) => void>
>;

export interface MockLogger {
  error: TLoggerMethod;
  info: TLoggerMethod;
  warn: TLoggerMethod;
  debug: TLoggerMethod;
}

export const createMockLogger = (): MockLogger => ({
  error: vi.fn<(context: unknown, message?: string) => void>(),
  info: vi.fn<(context: unknown, message?: string) => void>(),
  warn: vi.fn<(context: unknown, message?: string) => void>(),
  debug: vi.fn<(context: unknown, message?: string) => void>(),
});

export interface MockRedisConnection {
  on: TConnectionOnMethod;
  quit: TAsyncVoidMethod;
  disconnect: ReturnType<typeof vi.fn<() => void>>;
  status: string;
}

export const createMockRedisConnection = (
  overrides: Partial<MockRedisConnection> = {}
): MockRedisConnection => ({
  on: vi.fn<(event: string, handler: (...args: unknown[]) => void) => void>(),
  quit: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  disconnect: vi.fn<() => void>(),
  status: "ready",
  ...overrides,
});

export const asRedisConnection = (connection: MockRedisConnection): IORedis =>
  connection as unknown as IORedis;

export interface MockQueue {
  add: TQueueAddMethod;
  close: TAsyncVoidMethod;
  removeJobScheduler: TQueueRemoveSchedulerMethod;
  upsertJobScheduler: TQueueScheduleMethod;
  waitUntilReady: TAsyncVoidMethod;
}

export const createMockQueue = (overrides: Partial<MockQueue> = {}): MockQueue => ({
  add: vi.fn<(name: string, data: unknown, options?: unknown) => Promise<unknown>>(),
  close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  removeJobScheduler: vi.fn<(jobId: string) => Promise<boolean>>().mockResolvedValue(true),
  upsertJobScheduler: vi.fn<(jobId: string, schedule: unknown, template: unknown) => Promise<unknown>>(),
  waitUntilReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  ...overrides,
});

export const asQueue = (queue: MockQueue): Queue => queue as unknown as Queue;

export interface MockWorker {
  close: TAsyncVoidMethod;
  on: TWorkerOnMethod;
  waitUntilReady: TAsyncVoidMethod;
}

export const createMockWorker = (overrides: Partial<MockWorker> = {}): MockWorker => ({
  close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  on: vi.fn<(event: string, handler: (...args: unknown[]) => void) => void>(),
  waitUntilReady: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  ...overrides,
});

export const asWorker = (worker: MockWorker): Worker => worker as unknown as Worker;
