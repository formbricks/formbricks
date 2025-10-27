export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export const parseVersion = (version: string): VersionInfo | null => {
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/, "");

  // Regex for semantic versioning with optional patch and prerelease (no build metadata)
  // Supports both 2-part (1.2) and 3-part (1.2.3) versions
  const semverRegex = /^(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

  const match = semverRegex.exec(cleanVersion);
  if (!match) {
    console.warn(`Invalid version format: ${version}`);
    return null;
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : 0, // Default to 0 if patch is missing
    prerelease: match[4],
  };
};

const comparePrereleaseVersions = (current: string, latest: string): number => {
  const currentParts = current.split(".");
  const latestParts = latest.split(".");
  const max = Math.max(currentParts.length, latestParts.length);

  const isNumeric = (s: string) => /^\d+$/.test(s);

  const comparePart = (a?: string, b?: string): number => {
    if (!a && b) return 1; // latest has more segments → newer
    if (a && !b) return -1; // current has more segments → older
    if (!a && !b) return 0;

    const aNum = isNumeric(a!);
    const bNum = isNumeric(b!);
    if (aNum && bNum) return parseInt(b!, 10) - parseInt(a!, 10);
    return b!.localeCompare(a!);
  };

  for (let i = 0; i < max; i++) {
    const diff = comparePart(currentParts[i], latestParts[i]);
    if (diff !== 0) return diff;
  }
  return 0;
};

export const compareVersions = (current: string, latest: string): number => {
  const currentVersion = parseVersion(current);
  const latestVersion = parseVersion(latest);

  // If either version is invalid, treat as different
  if (!currentVersion || !latestVersion) {
    return current === latest ? 0 : -1;
  }

  // Compare major.minor.patch
  const majorDiff = latestVersion.major - currentVersion.major;
  if (majorDiff !== 0) return majorDiff;

  const minorDiff = latestVersion.minor - currentVersion.minor;
  if (minorDiff !== 0) return minorDiff;

  const patchDiff = latestVersion.patch - currentVersion.patch;
  if (patchDiff !== 0) return patchDiff;

  // Handle prerelease versions
  if (!currentVersion.prerelease && !latestVersion.prerelease) {
    return 0; // Both are stable, same version
  }

  if (!currentVersion.prerelease && latestVersion.prerelease) {
    return -1; // Current is stable, latest is prerelease - current is "newer"
  }

  if (currentVersion.prerelease && !latestVersion.prerelease) {
    return 1; // Current is prerelease, latest is stable - latest is newer
  }

  // Both are prerelease, compare properly
  return comparePrereleaseVersions(currentVersion.prerelease!, latestVersion.prerelease!);
};

export const isNewerVersion = (current: string, latest: string): boolean => {
  return compareVersions(current, latest) > 0;
};
