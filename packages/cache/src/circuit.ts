type CircuitState = {
  failures: number;
  retryAt: number;
  probing: boolean;
};

const globalForCircuit = globalThis as typeof globalThis & {
  formbricksCacheCircuit?: CircuitState;
};

const circuit = (globalForCircuit.formbricksCacheCircuit ??= {
  failures: 0,
  retryAt: 0,
  probing: false,
});

const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

export const isCacheCircuitOpen = (): boolean =>
  circuit.failures > 0 && (circuit.probing || Date.now() < circuit.retryAt);

/** Only one request in a process may try Redis after a cooldown. */
export const beginCacheProbe = (): boolean => {
  if (isCacheCircuitOpen()) return false;
  if (circuit.failures > 0) circuit.probing = true;
  return true;
};

export const recordCacheFailure = (): void => {
  circuit.failures += 1;
  const delay = Math.min(BASE_RETRY_MS * 2 ** Math.min(circuit.failures - 1, 10), MAX_RETRY_MS);
  circuit.retryAt = Date.now() + delay + Math.floor(Math.random() * Math.min(delay / 4, 1000));
  circuit.probing = false;
};

export const recordCacheSuccess = (): void => {
  circuit.failures = 0;
  circuit.retryAt = 0;
  circuit.probing = false;
};

export const resetCacheCircuit = (): void => {
  recordCacheSuccess();
};
