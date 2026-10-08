/**
 * CPU time this process has spent since `start` (a `process.cpuUsage()` reading), in milliseconds.
 * Unlike wall time, other processes on a loaded machine or CI runner do not stretch it, so a test can
 * hold a time bound on it without flaking.
 */
export const cpuMsSince = (start: NodeJS.CpuUsage): number => {
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000;
};
