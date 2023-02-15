interface FormSubmission {
  id: string;
  data: {
    role: string;
    disappointment: string;
  };
}

interface RoleCounts {
  [role: string]: number;
}

export function findRolesWithHighestVeryDisappointedPercentage(
  submissions: FormSubmission[],
  n: number
): string[] {
  const roleCounts: RoleCounts = {};
  const submissionCounts: RoleCounts = {};

  // Count the number of submissions for each role
  submissions.forEach((submission) => {
    const { role, disappointment } = submission.data;

    if (disappointment === "veryDisappointed") {
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }
    submissionCounts[role] = (submissionCounts[role] || 0) + 1;
  });

  const roles = Object.keys(roleCounts);
  let bestRoleCombination: string[] = [];
  let bestPercentage = 0;

  // Try all combinations of roles from 1 to n
  for (let i = 1; i <= n; i++) {
    const roleCombinations = generateCombinations(roles, i);

    // For each role combination, calculate the percentage of users who answered "veryDisappointed"
    roleCombinations.forEach((roleCombination) => {
      const totalSubmissions = roleCombination.reduce(
        (count, role) => count + (submissionCounts[role] || 0),
        0
      );
      const veryDisappointedSubmissions = roleCombination.reduce(
        (count, role) => count + (roleCounts[role] === undefined ? 0 : roleCounts[role]),
        0
      );

      const percentage = veryDisappointedSubmissions / totalSubmissions;
      if (
        percentage > bestPercentage ||
        (percentage === bestPercentage && roleCombination.length < bestRoleCombination.length)
      ) {
        bestPercentage = percentage;
        bestRoleCombination = roleCombination;
      }
    });
  }

  return bestRoleCombination;
}

function generateCombinations<T>(elements: T[], combinationLength: number): T[][] {
  if (combinationLength === 1) {
    return elements.map((element) => [element]);
  }

  const combinations: T[][] = [];

  for (let i = 0; i < elements.length; i++) {
    const subCombinations = generateCombinations(elements.slice(i + 1), combinationLength - 1);
    subCombinations.forEach((subCombination) => {
      combinations.push([elements[i], ...subCombination]);
    });
  }

  return combinations;
}
