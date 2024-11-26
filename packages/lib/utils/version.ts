export const isVersionGreaterThanOrEqualTo = (version: string, specificVersion: string) => {
  // return true; // uncomment when testing in demo app
  if (!version || !specificVersion) return false;

  const parts1 = version.split(".").map(Number);
  const parts2 = specificVersion.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }

  return true;
};
