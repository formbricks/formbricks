import { appendFileSync } from "node:fs";

const args = process.argv.slice(2);
appendFileSync(process.env.DOCKER_CALLS, `${JSON.stringify(args)}\n`);

const entrypoint = args[args.indexOf("--entrypoint") + 1];
if (entrypoint === "sh") {
  process.exit(0);
}
if (entrypoint !== "formbricks-authzed") {
  throw new Error(`Unexpected Docker entrypoint: ${entrypoint}`);
}

if (args.slice(-2).join(" ") === "upgrade check") {
  console.log(JSON.stringify({ code: "authzed_disabled", retryable: false, status: "failed" }));
} else if (args.at(-1) === "health") {
  const enabled = args.findLast((arg) => arg.startsWith("AUTHZED_ENABLED=")) === "AUTHZED_ENABLED=true";
  console.log(
    JSON.stringify(enabled ? { status: "unhealthy", retryable: true, latencyMs: 1 } : { status: "disabled" })
  );
} else {
  throw new Error("Unexpected AuthZed CLI command");
}
process.exit(1);
