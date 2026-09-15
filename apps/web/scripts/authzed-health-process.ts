import "server-only";

export const exitAfterStdoutFlush = (exitCode: number | string): void => {
  process.exitCode = exitCode;

  // Failed grpc-js connections can retain a TCP connect handle after client.close(). Health has
  // completed its SDK cleanup by this point, so terminate only after its JSON result is flushed.
  process.stdout.write("", () => process.exit(exitCode));
};
