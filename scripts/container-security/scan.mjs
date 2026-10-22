import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function imageRepository(image) {
  const name = image.split("@")[0].replace(/:[^/:]+$/, "");
  const first = name.split("/")[0];
  if (!name.includes("/")) return `docker.io/library/${name}`;
  return first.includes(".") || first.includes(":") || first === "localhost" ? name : `docker.io/${name}`;
}

export function selectPlatforms(manifest, config) {
  const entries = manifest.manifests ?? [{ digest: manifest.digest, platform: config }];
  const platforms = entries.filter(
    ({ platform }) => platform?.os === "linux" && ["amd64", "arm64"].includes(platform.architecture)
  );
  if (!platforms.length) throw new Error("Image has no supported linux/amd64 or linux/arm64 manifest");
  for (const entry of platforms) {
    if (!/^sha256:[a-f0-9]{64}$/.test(entry.digest)) throw new Error("Registry returned an invalid digest");
  }
  return platforms;
}

export function normalizeReport(report) {
  if (
    report.SchemaVersion !== 2 ||
    report.ArtifactType !== "container_image" ||
    !report.Metadata?.ImageID ||
    (report.Results != null && !Array.isArray(report.Results))
  ) {
    throw new Error("Incomplete Trivy report");
  }
  // Trivy omits Results entirely when an image has no detectable packages (e.g. BusyBox).
  return { ...report, Results: report.Results ?? [] };
}

export function scanImage(entry, outputDir, run = execFileSync) {
  mkdirSync(outputDir, { recursive: true });
  const result = { ...entry, scans: [], errors: [], expectedPlatforms: [], unavailablePlatforms: [] };
  const inspect = (ref, field) =>
    JSON.parse(
      run("docker", ["buildx", "imagetools", "inspect", ref, "--format", `{{json .${field}}}`], {
        encoding: "utf8",
        timeout: 120000,
      })
    );
  try {
    const manifest = inspect(entry.image, "Manifest");
    if (!/^sha256:[a-f0-9]{64}$/.test(manifest.digest)) throw new Error("Missing immutable manifest digest");
    const pinned = `${imageRepository(entry.image)}@${manifest.digest}`;
    const platforms = selectPlatforms(manifest, manifest.manifests ? null : inspect(pinned, "Image"));
    result.expectedPlatforms = platforms.map((p) => `linux/${p.platform.architecture}`);
    result.unavailablePlatforms = ["amd64", "arm64"].filter(
      (arch) => !platforms.some((p) => p.platform.architecture === arch)
    );
    for (const { digest, platform } of platforms) {
      const ref = `${imageRepository(entry.image)}@${digest}`;
      const platformName = `linux/${platform.architecture}`;
      const file = `${outputDir}/${platform.architecture}.json`;
      try {
        // No severity or ignore-unfixed filter: absence is used to reconcile Linear tickets.
        // Remote scanning never executes the image, and works without a Docker daemon.
        run(
          "trivy",
          [
            "image",
            "--parallel",
            "2",
            "--no-progress",
            "--skip-version-check",
            "--image-src",
            "remote",
            "--platform",
            platformName,
            "--scanners",
            "vuln",
            "--format",
            "json",
            "--timeout",
            "45m",
            "--output",
            file,
            ref,
          ],
          { stdio: "inherit", timeout: 46 * 60 * 1000 }
        );
        const report = normalizeReport(JSON.parse(readFileSync(file, "utf8")));
        if (!report.Results.length)
          console.warn(`${entry.image} (${platformName}): Trivy detected no supported packages`);
        result.scans.push({ platform: platformName, digest, report });
      } catch (error) {
        result.errors.push(`${platformName}: ${error.message}`);
      }
    }
  } catch (error) {
    result.errors.push(error.message);
  }
  writeFileSync(`${outputDir}/result.json`, JSON.stringify(result) + "\n");
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = scanImage(JSON.parse(process.env.SCAN_ENTRY), process.argv[2]);
  if (result.errors.length) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  }
}
